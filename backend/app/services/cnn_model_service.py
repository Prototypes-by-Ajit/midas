"""
CNN Model Service for Skin Cancer Classification
Handles model loading, inference, and GradCAM heatmap generation
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import cv2
import io
import logging
from typing import Dict, Tuple, Optional
from pathlib import Path
import inspect

from app.models.cnn_architecture import (
    MIDASCNNModel, CLASS_NAMES, CLASS_DESCRIPTIONS, RISK_LEVELS
)

logger = logging.getLogger(__name__)


class GradCAM:
    """Gradient-weighted Class Activation Mapping for explainability"""
    
    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Register hooks
        self.target_layer.register_forward_hook(self.forward_hook)
        self.target_layer.register_full_backward_hook(self.backward_hook)
    
    def forward_hook(self, module, input, output):
        self.activations = output.detach()
    
    def backward_hook(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()
    
    def generate_cam(self, input_image: torch.Tensor, target_class: int) -> np.ndarray:
        """Generate Class Activation Map"""
        # Forward pass
        self.model.eval()
        dummy_metadata = torch.zeros(1, 16).to(input_image.device)
        
        output = self.model(input_image, dummy_metadata)
        
        # Backward pass
        self.model.zero_grad()
        class_loss = output[0, target_class]
        class_loss.backward()
        
        # Generate CAM
        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        
        # ReLU + Normalize
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()
        
        # Normalize to [0, 1]
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        
        # Resize to input size
        cam = cv2.resize(cam, (224, 224))
        
        return cam
    
    def generate_overlay(self, original_image: Image.Image, cam: np.ndarray) -> np.ndarray:
        """Create heatmap overlay on original image"""
        # Resize original image
        img = original_image.resize((224, 224))
        img_array = np.array(img)
        
        # Create heatmap
        heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
        heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        
        # Overlay
        overlay = cv2.addWeighted(img_array, 0.6, heatmap, 0.4, 0)
        
        return overlay


class CNNModelService:
    """Service for CNN model inference and heatmap generation"""
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.gradcam = None
        self.transform = self._setup_transforms()
        self.model_path = Path(__file__).parent.parent.parent / "models" / "midas_v1_final_best.pth"
        
        logger.info(f"CNN Service initialized on device: {self.device}")
    
    def _setup_transforms(self):
        """Setup image preprocessing transforms"""
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
    
    def load_model(self):
        """Load trained model weights"""
        try:
            logger.info(f"Loading model from: {self.model_path}")
            
            # Create model architecture
            self.model = MIDASCNNModel(num_classes=7)
            
            # Load weights (allow numpy scalar for torch >= 2.6 safety checks)
            class MIDASConfig:
                pass
            MIDASConfig.__module__ = "__main__"
            class HyperparameterSearchConfig:
                pass
            HyperparameterSearchConfig.__module__ = "__main__"
            class FinalModelConfig:
                pass
            FinalModelConfig.__module__ = "__main__"

            import sys
            import pathlib
            pathlib.WindowsPath = pathlib.PureWindowsPath
            setattr(sys.modules.get("__main__"), "MIDASConfig", MIDASConfig)
            setattr(sys.modules.get("__main__"), "HyperparameterSearchConfig", HyperparameterSearchConfig)
            setattr(sys.modules.get("__main__"), "FinalModelConfig", FinalModelConfig)

            if hasattr(torch.serialization, "add_safe_globals"):
                torch.serialization.add_safe_globals([
                    np.core.multiarray.scalar,
                    np.dtype,
                    np.dtypes.Float64DType,
                    (pathlib.PureWindowsPath, "pathlib.WindowsPath"),
                    (MIDASConfig, "__main__.MIDASConfig"),
                    (HyperparameterSearchConfig, "__main__.HyperparameterSearchConfig"),
                    (FinalModelConfig, "__main__.FinalModelConfig")
                ])

            load_params = {"map_location": self.device}
            if "weights_only" in inspect.signature(torch.load).parameters:
                load_params["weights_only"] = True

            try:
                checkpoint = torch.load(self.model_path, **load_params)
            except Exception as e:
                if load_params.get("weights_only"):
                    logger.warning(
                        "weights_only load failed (%s); retrying with weights_only=False for trusted checkpoint",
                        e
                    )
                    checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=False)
                else:
                    raise
            
            # Handle different checkpoint formats
            if isinstance(checkpoint, dict):
                state_dict = checkpoint.get('model_state_dict', checkpoint.get('state_dict', checkpoint))
            else:
                state_dict = checkpoint
            
            # Load state dict
            self.model.load_state_dict(state_dict, strict=False)
            
            self.model.to(self.device)
            self.model.eval()
            
            # Setup GradCAM
            target_layer = self.model.image_encoder.backbone.blocks[-1]
            self.gradcam = GradCAM(self.model, target_layer)
            
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise RuntimeError(f"Model loading failed: {e}")
    
    def is_ready(self) -> bool:
        """Check if model is loaded and ready"""
        return self.model is not None
    
    async def analyze_image(
        self,
        image: Image.Image,
        generate_heatmap: bool = True
    ) -> Dict:
        """Analyze dermoscopy image"""
        if not self.is_ready():
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        try:
            # Ensure RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Preprocess
            img_tensor = self.transform(image).unsqueeze(0).to(self.device)
            dummy_metadata = torch.zeros(1, 16).to(self.device)
            
            # Inference
            self.model.eval()
            with torch.no_grad():
                logits = self.model(img_tensor, dummy_metadata)
                probabilities = F.softmax(logits, dim=1)
            
            # Extract results
            probs = probabilities[0].cpu().numpy()
            pred_idx = int(np.argmax(probs))
            confidence = float(probs[pred_idx])
            predicted_class = CLASS_NAMES[pred_idx]
            
            # Class probabilities dict
            class_probs = {
                CLASS_NAMES[i]: float(probs[i])
                for i in range(len(CLASS_NAMES))
            }
            
            # Generate heatmap
            heatmap = None
            if generate_heatmap and self.gradcam:
                try:
                    cam = self.gradcam.generate_cam(img_tensor, pred_idx)
                    heatmap = self.gradcam.generate_overlay(image, cam)
                except Exception as e:
                    logger.error(f"GradCAM generation failed: {e}")
            
            return {
                "class_probabilities": class_probs,
                "predicted_class": predicted_class,
                "predicted_class_name": CLASS_DESCRIPTIONS[predicted_class],
                "confidence": confidence,
                "risk_level": RISK_LEVELS[predicted_class],
                "heatmap": heatmap
            }
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise RuntimeError(f"Image analysis failed: {e}")
    
    def heatmap_to_bytes(self, heatmap: np.ndarray) -> bytes:
        """Convert heatmap numpy array to PNG bytes"""
        img = Image.fromarray(heatmap.astype('uint8'))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()


# Global service instance
cnn_model_service = CNNModelService()
