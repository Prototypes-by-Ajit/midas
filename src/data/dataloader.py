"""
Data loading and preprocessing for MIDAS system
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, List
import logging
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from sklearn.model_selection import train_test_split, StratifiedKFold

class SkinLesionDataset(Dataset):
    """
    PyTorch Dataset for skin lesion images.
    """
    
    def __init__(self, 
                 image_paths: List[Path],
                 labels: List[int],
                 transform: Optional[transforms.Compose] = None):
        """
        Initialize dataset.
        
        Args:
            image_paths: List of paths to images
            labels: List of corresponding labels
            transform: Optional transform to apply to images
        """
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform
    
    def __len__(self) -> int:
        return len(self.image_paths)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        """
        Get item by index.
        
        Args:
            idx: Index of item
        
        Returns:
            Tuple of (image tensor, label)
        """
        image_path = self.image_paths[idx]
        label = self.labels[idx]
        
        # Load image
        image = Image.open(image_path).convert('RGB')
        
        # Apply transforms
        if self.transform:
            image = self.transform(image)
        
        return image, label

class DataManager:
    """
    Manages data loading and preprocessing for MIDAS system.
    """
    
    def __init__(self, config, logger: Optional[logging.Logger] = None):
        """
        Initialize DataManager.
        
        Args:
            config: Configuration object
            logger: Optional logger instance
        """
        self.config = config
        self.logger = logger or logging.getLogger(__name__)
        self.datasets = {}
        
    def load_metadata(self, file_path: Path, dataset_name: str) -> Optional[pd.DataFrame]:
        """
        Load metadata CSV file.
        
        Args:
            file_path: Path to metadata file
            dataset_name: Name of dataset for logging
        
        Returns:
            DataFrame or None if loading fails
        """
        if not file_path.exists():
            self.logger.warning(f"{dataset_name} metadata not found at: {file_path}")
            return None
        
        try:
            df = pd.read_csv(file_path)
            self.logger.info(f"Successfully loaded {dataset_name} metadata.")
            self.logger.info(f"  - Shape: {df.shape}")
            self.logger.info(f"  - Columns: {df.columns.tolist()}")
            self.logger.info(f"  - Missing Values: {df.isnull().sum().sum()}")
            return df
        except Exception as e:
            self.logger.error(f"Failed to load {dataset_name} metadata: {e}")
            return None
    
    def discover_images(self, image_dir: Path, dataset_name: str) -> List[Path]:
        """
        Discover images in directory.
        
        Args:
            image_dir: Directory containing images
            dataset_name: Name of dataset for logging
        
        Returns:
            List of image paths
        """
        if not image_dir.exists():
            self.logger.warning(f"{dataset_name} image directory not found at: {image_dir}")
            return []
        
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']
        image_files = []
        
        for ext in image_extensions:
            image_files.extend(list(image_dir.glob(ext)))
        
        self.logger.info(f"Found {len(image_files)} images for {dataset_name}")
        return image_files
    
    def load_ham10000(self) -> Dict:
        """
        Load HAM10000 dataset.
        
        Returns:
            Dictionary containing dataset information
        """
        metadata = self.load_metadata(self.config.ham10000_metadata, "HAM10000")
        images = self.discover_images(self.config.ham10000_images, "HAM10000")
        
        if metadata is not None:
            return {
                'metadata': metadata,
                'image_paths': images,
                'image_count': len(images)
            }
        return {}
    
    def load_pad_ufes20(self) -> Dict:
        """
        Load PAD-UFES-20 dataset.
        
        Returns:
            Dictionary containing dataset information
        """
        metadata = self.load_metadata(self.config.pad_ufes20_metadata, "PAD-UFES-20")
        images = self.discover_images(self.config.pad_ufes20_images, "PAD-UFES-20")
        
        if metadata is not None:
            return {
                'metadata': metadata,
                'image_paths': images,
                'image_count': len(images)
            }
        return {}
    
    def get_transforms(self, is_train: bool = True) -> transforms.Compose:
        """
        Get image transforms.
        
        Args:
            is_train: Whether to include augmentation for training
        
        Returns:
            Composed transforms
        """
        if is_train:
            return transforms.Compose([
                transforms.Resize((self.config.image_size[0] + 32, self.config.image_size[1] + 32)),
                transforms.RandomCrop(self.config.image_size),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomVerticalFlip(p=0.5),
                transforms.RandomRotation(degrees=20),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.config.normalize_mean, std=self.config.normalize_std)
            ])
        else:
            return transforms.Compose([
                transforms.Resize(self.config.image_size),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.config.normalize_mean, std=self.config.normalize_std)
            ])
    
    def create_data_loaders(self, 
                          image_paths: List[Path],
                          labels: List[int],
                          batch_size: int = 32,
                          val_split: float = 0.2,
                          test_split: float = 0.1) -> Tuple[DataLoader, DataLoader, DataLoader]:
        """
        Create train, validation, and test data loaders.
        
        Args:
            image_paths: List of image paths
            labels: List of labels
            batch_size: Batch size for loaders
            val_split: Validation split ratio
            test_split: Test split ratio
        
        Returns:
            Tuple of (train_loader, val_loader, test_loader)
        """
        # Split data
        X_temp, X_test, y_temp, y_test = train_test_split(
            image_paths, labels, test_size=test_split, stratify=labels, random_state=self.config.seed
        )
        
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp, test_size=val_split/(1-test_split), stratify=y_temp, random_state=self.config.seed
        )
        
        # Create datasets
        train_dataset = SkinLesionDataset(X_train, y_train, self.get_transforms(is_train=True))
        val_dataset = SkinLesionDataset(X_val, y_val, self.get_transforms(is_train=False))
        test_dataset = SkinLesionDataset(X_test, y_test, self.get_transforms(is_train=False))
        
        # Create loaders
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4, pin_memory=True)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True)
        test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True)
        
        self.logger.info(f"Data splits - Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
        
        return train_loader, val_loader, test_loader
