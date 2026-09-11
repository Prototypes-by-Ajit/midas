"""
CNN Model Service for Skin Cancer Classification
Handles model loading, inference, and Grad-CAM heatmap generation.

Runs the ONNX export of the trained checkpoint on ONNX Runtime (CPU). Measured
on this model vs. eager PyTorch: ~5 ms vs ~310 ms per image, and no second copy
of the weights in the process. The graph is produced by
scripts/export_cnn_onnx.py; its "cams" output is exact Grad-CAM (see
OnnxExportWrapper), so no autograd is needed at runtime.
"""

from PIL import Image
import numpy as np
import cv2
import io
import logging
from typing import Dict
from pathlib import Path

import onnxruntime as ort

from app.models.cnn_architecture import (
    CLASS_NAMES, CLASS_DESCRIPTIONS, resolve_risk_level
)

logger = logging.getLogger(__name__)

# ImageNet normalisation, matching the training transforms
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def preprocess(image: Image.Image) -> np.ndarray:
    """PIL RGB image -> (1, 3, 224, 224) float32.

    Same as the old torchvision Resize((224, 224)) + ToTensor + Normalize:
    torchvision's Resize on a PIL image delegates to PIL bilinear.
    """
    arr = np.asarray(image.resize((224, 224), Image.BILINEAR), dtype=np.float32) / 255.0
    return ((arr.transpose(2, 0, 1) - _MEAN) / _STD)[None].astype(np.float32)


def _softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - logits.max())
    return e / e.sum()


def _overlay(original_image: Image.Image, cam: np.ndarray) -> np.ndarray:
    """Normalise a 7x7 CAM, upsample, and blend it over the image."""
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    cam = cv2.resize(cam.astype(np.float32), (224, 224))

    img_array = np.array(original_image.resize((224, 224)))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(img_array, 0.6, heatmap, 0.4, 0)


class CNNModelService:
    """Service for CNN model inference and heatmap generation"""

    def __init__(self):
        self.device = "cpu"
        self.session = None
        self.model_path = Path(__file__).parent.parent.parent / "models" / "midas_v1_final_best.onnx"

    def load_model(self):
        """Load the exported ONNX graph"""
        try:
            logger.info(f"Loading model from: {self.model_path}")
            self.session = ort.InferenceSession(
                str(self.model_path), providers=["CPUExecutionProvider"]
            )
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise RuntimeError(
                f"Model loading failed: {e} (run scripts/export_cnn_onnx.py to create it)"
            )

    def is_ready(self) -> bool:
        """Check if model is loaded and ready"""
        return self.session is not None

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

            logits, cams = self.session.run(None, {
                "image": preprocess(image),
                "metadata": np.zeros((1, 16), dtype=np.float32),
            })

            probs = _softmax(logits[0])
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
            if generate_heatmap:
                try:
                    heatmap = _overlay(image, cams[0, pred_idx])
                except Exception as e:
                    logger.error(f"GradCAM generation failed: {e}")

            return {
                "class_probabilities": class_probs,
                "predicted_class": predicted_class,
                "predicted_class_name": CLASS_DESCRIPTIONS[predicted_class],
                "confidence": confidence,
                "risk_level": resolve_risk_level(predicted_class, class_probs),
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
