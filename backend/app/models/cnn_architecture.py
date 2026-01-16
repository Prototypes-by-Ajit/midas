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
