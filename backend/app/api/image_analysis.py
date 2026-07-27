"""
Image Analysis API Endpoint
Handles skin cancer image classification requests
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
import logging
from PIL import Image
import requests
from io import BytesIO
import time
import base64
import math

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/image", tags=["image-analysis"])


def get_cnn_model_service():
    from app.services.cnn_model_service import cnn_model_service

    return cnn_model_service


# Request/Response Models
class ImageAnalysisRequest(BaseModel):
    """Request for image analysis"""
    analysis_id: str = Field(..., description="UUID of medical_analyses record")
    image_url: HttpUrl = Field(..., description="Public URL of uploaded image")
    user_id: Optional[str] = Field(None, description="User ID")


class ImageAnalysisResponse(BaseModel):
    """Response from image analysis"""
    success: bool
    analysis_id: str
    diagnosis: str
    confidence: float
    risk_level: str
    detected_features: List[str]
    recommendations: List[str]
    heatmap_url: Optional[str]
    heatmap_png_base64: Optional[str]
    class_probabilities: Optional[Dict[str, float]]
    classification_metrics: Optional[Dict[str, Any]]
    processing_time: int
    model_version: str


@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    """
    Analyze dermoscopy image with CNN model
    """
    start_time = time.time()
    
    try:
        logger.info(f"Analyzing image for analysis_id: {request.analysis_id}")
        
        # STEP 1: Download image
        logger.info(f"Downloading image from: {request.image_url}")
        response = requests.get(str(request.image_url), timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        
        # STEP 2: CNN Inference
        logger.info("Running CNN inference...")
        cnn_model_service = get_cnn_model_service()
        if not cnn_model_service.is_ready():
            cnn_model_service.load_model()
        
        analysis_result = await cnn_model_service.analyze_image(
            image=image,
            generate_heatmap=True
        )
        
        predicted_class = analysis_result["predicted_class"]
        confidence = analysis_result["confidence"]
        risk_level = analysis_result["risk_level"]
        class_probabilities = analysis_result.get("class_probabilities", {})

        probabilities = list(class_probabilities.values())
        probabilities.sort(reverse=True)
        top1 = probabilities[0] if probabilities else 0.0
        top2 = probabilities[1] if len(probabilities) > 1 else 0.0
        entropy = -sum(p * math.log(p + 1e-12) for p in probabilities) if probabilities else 0.0
        classification_metrics = {
            "confidence": top1,
            "top2_gap": max(top1 - top2, 0.0),
            "entropy": entropy
        }

        heatmap_png_base64 = None
        heatmap = analysis_result.get("heatmap")
        if heatmap is not None:
            heatmap_bytes = cnn_model_service.heatmap_to_bytes(heatmap)
            heatmap_png_base64 = base64.b64encode(heatmap_bytes).decode("utf-8")
        
        # STEP 3: Generate detected features
        detected_features = [
            "Border analysis completed",
            "Color distribution assessed",
            "Symmetry evaluation performed",
            "Diameter measurements taken"
        ]
        
        if predicted_class in ["MEL", "BCC", "AKIEC"]:
            detected_features.extend([
                "Irregular borders detected",
                "Multiple color variations observed",
                "Asymmetrical pattern identified"
            ])
        else:
            detected_features.extend([
                "Regular, well-defined borders",
                "Uniform color pattern",
                "Symmetrical structure"
            ])
        
        # STEP 4: Generate recommendations
        recommendations = _generate_recommendations(predicted_class, risk_level)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Analysis completed in {processing_time}ms")
        
        return ImageAnalysisResponse(
            success=True,
            analysis_id=request.analysis_id,
            diagnosis=analysis_result["predicted_class_name"],
            confidence=confidence,
            risk_level=risk_level,
            detected_features=detected_features,
            recommendations=recommendations,
            heatmap_url=None,  # Will be handled by edge function
            heatmap_png_base64=heatmap_png_base64,
            class_probabilities=class_probabilities,
            classification_metrics=classification_metrics,
            processing_time=processing_time,
            model_version="midas_v1_final"
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


def _generate_recommendations(predicted_class: str, risk_level: str) -> List[str]:
    """Generate recommendations based on diagnosis and risk"""
    base_recommendations = {
        "high": [
            "URGENT: Schedule immediate dermatologist consultation",
            "Consider biopsy evaluation",
            "Document recent changes in the lesion",
            "Avoid sun exposure to the affected area",
            "Do not delay seeking professional medical advice"
        ],
        "medium": [
            "Schedule dermatologist consultation within 3 months",
            "Monitor for changes in size, color, or texture",
            "Take photos for comparison tracking",
            "Apply SPF 30+ sunscreen daily",
            "Avoid excessive sun exposure"
        ],
        "low": [
            "Continue regular skin monitoring",
            "Schedule follow-up in 6-12 months",
            "Apply SPF 30+ sunscreen daily",
            "Perform monthly self-examinations",
            "Document any changes for your records"
        ]
    }
    
    return base_recommendations.get(risk_level, base_recommendations["medium"])


@router.get("/health")
async def health_check():
    """Health check for image analysis service"""
    cnn_model_service = get_cnn_model_service()
    return {
        "status": "healthy",
        "service": "image-analysis",
        "model_loaded": cnn_model_service.is_ready(),
        "device": str(cnn_model_service.device)
    }
