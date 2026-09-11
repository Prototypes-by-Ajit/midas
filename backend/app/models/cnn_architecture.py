"""
PyTorch CNN Model Architecture for MIDAS Skin Cancer Classification
Matches the saved model at midas_v1_final_best.pth
"""

import torch
import torch.nn as nn
import timm
from typing import Dict, Tuple

class ImageEncoder(nn.Module):
    """EfficientNet-B0 image encoder"""
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model(
            'efficientnet_b0', 
            pretrained=False, 
            num_classes=0
        )
        self.num_features = self.backbone.num_features
    
    def forward(self, x):
        return self.backbone(x)


class MetadataEncoder(nn.Module):
    """Metadata encoder for patient/lesion metadata"""
    def __init__(self, input_dim=16, hidden_dims=[256, 128]):
        super().__init__()
        layers = []
        prev_dim = input_dim
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(inplace=True),
                nn.Dropout(0.3)
            ])
            prev_dim = hidden_dim
        
        self.encoder = nn.Sequential(*layers)
        self.output_dim = hidden_dims[-1]
    
    def forward(self, x):
        return self.encoder(x)


class MIDASCNNModel(nn.Module):
    """
    MIDAS Skin Cancer Classification Model
    Architecture: EfficientNet-B0 + Metadata Fusion + Classifier
    """
    def __init__(self, num_classes=7):
        super().__init__()
        self.image_encoder = ImageEncoder()
        self.metadata_encoder = MetadataEncoder()
        
        # Fusion and classification
        fused_dim = self.image_encoder.num_features + self.metadata_encoder.output_dim
        
        self.classifier = nn.Sequential(
            nn.Linear(fused_dim, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(512, num_classes)
        )
    
    def forward(self, image, metadata):
        """
        Args:
            image: (B, 3, 224, 224) image tensor
            metadata: (B, 16) metadata tensor
        Returns:
            logits: (B, 7) class logits
        """
        img_features = self.image_encoder(image)
        meta_features = self.metadata_encoder(metadata)
        
        fused_features = torch.cat([img_features, meta_features], dim=1)
        logits = self.classifier(fused_features)
        
        return logits


# Class mappings (HAM10000 dataset)
CLASS_NAMES = {
    0: "AKIEC",  # Actinic Keratoses and Intraepithelial Carcinoma
    1: "BCC",    # Basal Cell Carcinoma
    2: "BKL",    # Benign Keratosis-like Lesions
    3: "DF",     # Dermatofibroma
    4: "MEL",    # Melanoma
    5: "NV",     # Melanocytic Nevi
    6: "VASC"    # Vascular Lesions
}

CLASS_DESCRIPTIONS = {
    "AKIEC": "Actinic Keratoses and Intraepithelial Carcinoma",
    "BCC": "Basal Cell Carcinoma",
    "BKL": "Benign Keratosis-like Lesions",
    "DF": "Dermatofibroma",
    "MEL": "Melanoma",
    "NV": "Melanocytic Nevi (Common Mole)",
    "VASC": "Vascular Lesions"
}

# Risk level mapping
RISK_LEVELS = {
    "AKIEC": "medium",
    "BCC": "high",
    "BKL": "low",
    "DF": "low",
    "MEL": "high",
    "NV": "low",
    "VASC": "low"
}

RISK_INDETERMINATE = "indeterminate"

_HIGH_RISK_CLASSES = frozenset(c for c, r in RISK_LEVELS.items() if r == "high")


def resolve_risk_level(predicted_class: str, class_probabilities: dict) -> str:
    """Risk tier for a prediction, or "indeterminate" when it isn't supported.

    Looking up RISK_LEVELS directly ignores how sure the model was, which is
    wrong because the tier is a decision, not a display: it selects the clinical
    advice, goes into the PDF, and is fed to the report LLM. A nevus predicted
    at 22% would otherwise return "low" and recommend a 6-12 month follow-up.

    Parameter-free by design. No held-out data is available in the repo, so any
    tuned cut-point would be an invented number -- exactly what this function
    exists to stop. One criterion, "does it hold the majority", applied twice:

    * Support: assert a tier only when the predicted class carries more
      probability mass than every other class combined.
    * Escalate, never downgrade: a "low" tier additionally requires that the
      high-risk classes do NOT hold the majority of the remaining mass. A
      decisive nevus with a 2% melanoma runner-up stays low; a 55% nevus with
      30% melanoma behind it does not.

    Note this deliberately tests mass, not rank. Ranking alone would escalate
    every prediction whose second place happens to be melanoma, however small.
    """
    base = RISK_LEVELS.get(predicted_class)
    if base is None:
        return RISK_INDETERMINATE

    probabilities = class_probabilities or {}
    top = probabilities.get(predicted_class)
    if top is None:
        # No distribution to reason about; do not invent certainty.
        return RISK_INDETERMINATE

    alternatives = sum(probabilities.values()) - top
    high_risk_mass = sum(p for c, p in probabilities.items() if c in _HIGH_RISK_CLASSES)

    if top <= alternatives:
        # The alternatives outweigh the call, so no tier is supported. Still
        # escalate rather than stay silent when a high-risk class is in play.
        high_risk_ranked_top2 = any(
            c in _HIGH_RISK_CLASSES
            for c, _ in sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)[:2]
        )
        return "medium" if high_risk_ranked_top2 else RISK_INDETERMINATE

    if base == "low" and high_risk_mass > alternatives - high_risk_mass:
        return "medium"
    return base


def load_trained_model(model_path) -> MIDASCNNModel:
    """Load the trained checkpoint into a CPU eval-mode model.

    Only the ONNX export script and the offline regression test need this;
    the live service runs the exported ONNX graph (see cnn_model_service).
    """
    import inspect
    import pathlib
    import sys

    import numpy as np

    model = MIDASCNNModel(num_classes=7)

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

    load_params = {"map_location": "cpu"}
    if "weights_only" in inspect.signature(torch.load).parameters:
        load_params["weights_only"] = True

    try:
        checkpoint = torch.load(model_path, **load_params)
    except Exception:
        if not load_params.get("weights_only"):
            raise
        # trusted local checkpoint
        checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)

    # Handle different checkpoint formats
    if isinstance(checkpoint, dict):
        state_dict = checkpoint.get('model_state_dict', checkpoint.get('state_dict', checkpoint))
    else:
        state_dict = checkpoint

    # The checkpoint stores the head as classifier.classifier.* (training wrapped an
    # inner nn.Sequential); this architecture declares it flat as classifier.*.
    # strict=True is the guard: without it these 9 tensors are dropped in silence and
    # the head stays randomly initialised, making every prediction noise.
    state_dict = {
        (k.replace("classifier.classifier.", "classifier.", 1)
         if k.startswith("classifier.classifier.") else k): v
        for k, v in state_dict.items()
    }
    model.load_state_dict(state_dict, strict=True)
    return model.eval()


class OnnxExportWrapper(nn.Module):
    """Forward pass that also emits a Grad-CAM map for every class.

    Grad-CAM needs d(logit)/d(feature map), which ONNX Runtime can't compute.
    It doesn't have to: the target is the backbone's final 1280x7x7 map, which
    is global-average-pooled, so the gradient is spatially constant and equals
    d(logit)/d(pooled) / (H*W). The head after pooling is
    Linear -> BN(eval) -> ReLU -> Linear, whose gradient is closed-form:

        d logit_c / d pooled = W2[c] * relu_mask * bn_scale @ W1[:, :1280]

    This is exact Grad-CAM at that layer, not an approximation
    (test_cnn_model_load.py checks it against autograd).
    """

    def __init__(self, model: MIDASCNNModel):
        super().__init__()
        self.model = model

    def forward(self, image, metadata):
        backbone = self.model.image_encoder.backbone
        fmap = backbone.forward_features(image)            # (B, 1280, 7, 7)
        pooled = fmap.mean(dim=(2, 3))                     # == timm global_pool (avg)
        meta = self.model.metadata_encoder(metadata)
        lin1, bn, _, _, lin2 = self.model.classifier
        hidden = bn(lin1(torch.cat([pooled, meta], dim=1)))  # pre-ReLU, (B, 512)
        logits = lin2(torch.relu(hidden))

        bn_scale = bn.weight / torch.sqrt(bn.running_var + bn.eps)                 # (512,)
        gated = lin2.weight.unsqueeze(0) * ((hidden > 0).float() * bn_scale).unsqueeze(1)  # (B, 7, 512)
        weights = gated @ lin1.weight[:, :pooled.shape[1]]                          # (B, 7, 1280)
        cams = torch.relu(torch.einsum("bck,bkhw->bchw", weights, fmap))           # (B, 7, 7, 7)
        return logits, cams
