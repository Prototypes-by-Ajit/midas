"""
FastAPI backend for MIDAS inference
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import torch.nn.functional as F
from PIL import Image
import io
import numpy as np
from typing import Dict, List, Optional
import logging
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from config.config import MIDASConfig
from models.model import ModelFactory, load_checkpoint
from data.dataloader import DataManager

# Initialize FastAPI app
app = FastAPI(
    title="MIDAS API",
    description="API for skin cancer detection using MIDAS model",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
config = MIDASConfig()
model = None
device = None
data_manager = None
logger = logging.getLogger(__name__)

def load_model(model_path: Optional[str] = None):
    """Load the trained model."""
    global model, device
    
    device = torch.device(config.device)
    
    # Create model
    model = ModelFactory.create_model(
        model_name='efficientnet_b0',
        num_classes=config.num_classes,
        pretrained=False
    )
    
    # Load checkpoint if provided
    if model_path and Path(model_path).exists():
        model = load_checkpoint(model, model_path, device, logger)
    
    model.to(device)
    model.eval()
    
    logger.info(f"Model loaded on {device}")

@app.on_event("startup")
async def startup_event():
    """Initialize model and data manager on startup."""
    global data_manager
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Initialize data manager
    data_manager = DataManager(config, logger)
    
    # Load model
    model_path = config.models_dir / "trained" / "best_model.pth"
    load_model(str(model_path) if model_path.exists() else None)
    
    logger.info("API startup complete")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MIDAS API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": model is not None
    }

@app.get("/classes")
async def get_classes():
    """Get list of classes."""
    return {
        "classes": config.class_names,
        "class_descriptions": config.class_name_map
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Predict skin lesion class from uploaded image.
    
    Args:
        file: Uploaded image file
    
    Returns:
        Prediction results
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Apply transforms
        transform = data_manager.get_transforms(is_train=False)
        image_tensor = transform(image).unsqueeze(0).to(device)
        
        # Make prediction
        with torch.no_grad():
            outputs = model(image_tensor)
            probabilities = F.softmax(outputs, dim=1)
            
            # Get top predictions
            top_probs, top_indices = torch.topk(probabilities[0], k=min(3, config.num_classes))
            
            predictions = []
            for i in range(len(top_indices)):
                class_idx = top_indices[i].item()
                class_name = config.class_names[class_idx]
                class_desc = config.class_name_map.get(class_name.lower(), class_name)
                prob = top_probs[i].item()
                
                predictions.append({
                    "class": class_name,
                    "description": class_desc,
                    "confidence": float(prob * 100)
                })
        
        # Get primary prediction
        primary_class = predictions[0]["class"]
        primary_confidence = predictions[0]["confidence"]
        
        return {
            "success": True,
            "primary_prediction": {
                "class": primary_class,
                "description": predictions[0]["description"],
                "confidence": primary_confidence
            },
            "all_predictions": predictions,
            "risk_level": get_risk_level(primary_class, primary_confidence)
        }
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch_predict")
async def batch_predict(files: List[UploadFile] = File(...)):
    """
    Predict skin lesion classes for multiple images.
    
    Args:
        files: List of uploaded image files
    
    Returns:
        Batch prediction results
    """
    results = []
    
    for file in files:
        try:
            result = await predict(file)
            results.append({
                "filename": file.filename,
                "prediction": result
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return {"results": results}

def get_risk_level(class_name: str, confidence: float) -> str:
    """
    Determine risk level based on prediction.
    
    Args:
        class_name: Predicted class
        confidence: Confidence score
    
    Returns:
        Risk level string
    """
    high_risk_classes = ['MEL', 'BCC', 'AKIEC']
    medium_risk_classes = ['BKL']
    
    if class_name in high_risk_classes:
        if confidence > 70:
            return "HIGH"
        else:
            return "MEDIUM"
    elif class_name in medium_risk_classes:
        return "MEDIUM"
    else:
        return "LOW"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "inference_api:app",
        host=config.api_host,
        port=config.api_port,
        reload=True
    )
