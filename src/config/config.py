"""
MIDAS V1: Multi-Modal Skin Cancer Detection System
Configuration Module
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict
import os

@dataclass
class MIDASConfig:
    """Configuration class for the MIDAS system."""
    
    # Project Settings
    project_name: str = "MIDAS-V1"
    seed: int = 42
    device: str = "cuda" if os.environ.get("CUDA_AVAILABLE", "true").lower() == "true" else "cpu"
    
    # Base Paths
    base_dir: Path = Path(__file__).parent.parent.parent  # Points to project root
    data_dir: Path = base_dir / "data"
    models_dir: Path = base_dir / "models"
    results_dir: Path = base_dir / "results"
    logs_dir: Path = base_dir / "logs"
    
    # Dataset Specific Paths
    ham10000_images: Path = data_dir / "ham10000" / "images"
    ham10000_metadata: Path = data_dir / "ham10000" / "metadata" / "HAM10000_metadata.csv"
    pad_ufes20_images: Path = data_dir / "pad_ufes20" / "images"
    pad_ufes20_metadata: Path = data_dir / "pad_ufes20" / "metadata" / "metadata.csv"
    
    # Model Settings
    num_classes: int = 7
    class_names: List[str] = field(default_factory=lambda: [
        'AKIEC', 'BCC', 'BKL', 'DF', 'MEL', 'NV', 'VASC'
    ])
    
    class_name_map: Dict[str, str] = field(default_factory=lambda: {
        'akiec': 'Actinic Keratoses',
        'bcc': 'Basal Cell Carcinoma',
        'bkl': 'Benign Keratosis',
        'df': 'Dermatofibroma',
        'mel': 'Melanoma',
        'nv': 'Nevus',
        'vasc': 'Vascular Lesions'
    })
    
    # Training Settings
    batch_size: int = 32
    learning_rate: float = 0.001
    num_epochs: int = 50
    validation_split: float = 0.2
    test_split: float = 0.1
    
    # Image Settings
    image_size: tuple = (224, 224)
    normalize_mean: List[float] = field(default_factory=lambda: [0.485, 0.456, 0.406])
    normalize_std: List[float] = field(default_factory=lambda: [0.229, 0.224, 0.225])
    
    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    
    def __post_init__(self):
        """Create directories if they don't exist after initialization."""
        self.models_dir.mkdir(parents=True, exist_ok=True)
        (self.models_dir / "checkpoints").mkdir(exist_ok=True)
        (self.models_dir / "trained").mkdir(exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        (self.results_dir / "plots").mkdir(exist_ok=True)
        (self.results_dir / "metrics").mkdir(exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
    
    def to_dict(self) -> dict:
        """Convert config to dictionary for serialization."""
        return {
            "project_name": self.project_name,
            "seed": self.seed,
            "device": self.device,
            "num_classes": self.num_classes,
            "class_names": self.class_names,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate,
            "num_epochs": self.num_epochs,
            "image_size": self.image_size
        }

# Global config instance
config = MIDASConfig()
