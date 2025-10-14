"""
Deep learning models for MIDAS system
"""

import torch
import torch.nn as nn
import timm
from typing import Optional, Dict, Any
import logging

class MIDASModel(nn.Module):
    """
    MIDAS deep learning model for skin lesion classification.
    Uses transfer learning with pre-trained models from timm.
    """
    
    def __init__(self, 
                 model_name: str = 'efficientnet_b0',
                 num_classes: int = 7,
                 pretrained: bool = True,
                 dropout_rate: float = 0.2):
        """
        Initialize MIDAS model.
        
        Args:
            model_name: Name of the base model from timm
            num_classes: Number of output classes
            pretrained: Whether to use pretrained weights
            dropout_rate: Dropout rate for regularization
        """
        super(MIDASModel, self).__init__()
        
        self.model_name = model_name
        self.num_classes = num_classes
        
        # Load base model from timm
        self.base_model = timm.create_model(
            model_name,
            pretrained=pretrained,
            num_classes=num_classes
        )
        
        # Get the number of features from the last layer
        if hasattr(self.base_model, 'classifier'):
            in_features = self.base_model.classifier.in_features
            # Replace classifier with custom head
            self.base_model.classifier = nn.Sequential(
                nn.Dropout(dropout_rate),
                nn.Linear(in_features, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(dropout_rate),
                nn.Linear(512, num_classes)
            )
        elif hasattr(self.base_model, 'fc'):
            in_features = self.base_model.fc.in_features
            # Replace fc layer with custom head
            self.base_model.fc = nn.Sequential(
                nn.Dropout(dropout_rate),
                nn.Linear(in_features, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(dropout_rate),
                nn.Linear(512, num_classes)
            )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass through the model.
        
        Args:
            x: Input tensor of shape (batch_size, channels, height, width)
        
        Returns:
            Output tensor of shape (batch_size, num_classes)
        """
        return self.base_model(x)
    
    def freeze_backbone(self) -> None:
        """
        Freeze the backbone layers for fine-tuning only the head.
        """
        for param in self.base_model.parameters():
            param.requires_grad = False
        
        # Unfreeze the classifier/fc layer
        if hasattr(self.base_model, 'classifier'):
            for param in self.base_model.classifier.parameters():
                param.requires_grad = True
        elif hasattr(self.base_model, 'fc'):
            for param in self.base_model.fc.parameters():
                param.requires_grad = True
    
    def unfreeze_backbone(self) -> None:
        """
        Unfreeze all layers for full model training.
        """
        for param in self.base_model.parameters():
            param.requires_grad = True

class ModelFactory:
    """
    Factory class for creating different model architectures.
    """
    
    SUPPORTED_MODELS = [
        'efficientnet_b0',
        'efficientnet_b1',
        'efficientnet_b2',
        'efficientnet_b3',
        'resnet18',
        'resnet34',
        'resnet50',
        'densenet121',
        'mobilenetv3_small_100',
        'mobilenetv3_large_100',
        'vit_small_patch16_224',
        'vit_base_patch16_224'
    ]
    
    @classmethod
    def create_model(cls,
                    model_name: str,
                    num_classes: int = 7,
                    pretrained: bool = True,
                    dropout_rate: float = 0.2) -> MIDASModel:
        """
        Create a model instance.
        
        Args:
            model_name: Name of the model architecture
            num_classes: Number of output classes
            pretrained: Whether to use pretrained weights
            dropout_rate: Dropout rate
        
        Returns:
            Model instance
        
        Raises:
            ValueError: If model_name is not supported
        """
        if model_name not in cls.SUPPORTED_MODELS:
            raise ValueError(f"Model {model_name} not supported. Choose from {cls.SUPPORTED_MODELS}")
        
        return MIDASModel(
            model_name=model_name,
            num_classes=num_classes,
            pretrained=pretrained,
            dropout_rate=dropout_rate
        )
    
    @classmethod
    def get_model_info(cls, model_name: str) -> Dict[str, Any]:
        """
        Get information about a model.
        
        Args:
            model_name: Name of the model
        
        Returns:
            Dictionary containing model information
        """
        model = timm.create_model(model_name, pretrained=False)
        
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        
        return {
            'model_name': model_name,
            'total_parameters': total_params,
            'trainable_parameters': trainable_params,
            'input_size': model.default_cfg.get('input_size', (3, 224, 224))
        }

def load_checkpoint(model: nn.Module, 
                   checkpoint_path: str,
                   device: str = 'cpu',
                   logger: Optional[logging.Logger] = None) -> nn.Module:
    """
    Load model checkpoint.
    
    Args:
        model: Model instance
        checkpoint_path: Path to checkpoint file
        device: Device to load model on
        logger: Optional logger
    
    Returns:
        Model with loaded weights
    """
    try:
        checkpoint = torch.load(checkpoint_path, map_location=device)
        
        if 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
        else:
            model.load_state_dict(checkpoint)
        
        if logger:
            logger.info(f"Successfully loaded checkpoint from {checkpoint_path}")
        
        return model
    except Exception as e:
        if logger:
            logger.error(f"Failed to load checkpoint: {e}")
        raise

def save_checkpoint(model: nn.Module,
                   optimizer: torch.optim.Optimizer,
                   epoch: int,
                   loss: float,
                   checkpoint_path: str,
                   logger: Optional[logging.Logger] = None) -> None:
    """
    Save model checkpoint.
    
    Args:
        model: Model instance
        optimizer: Optimizer instance
        epoch: Current epoch
        loss: Current loss
        checkpoint_path: Path to save checkpoint
        logger: Optional logger
    """
    try:
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'loss': loss
        }
        
        torch.save(checkpoint, checkpoint_path)
        
        if logger:
            logger.info(f"Checkpoint saved to {checkpoint_path}")
    except Exception as e:
        if logger:
            logger.error(f"Failed to save checkpoint: {e}")
        raise
