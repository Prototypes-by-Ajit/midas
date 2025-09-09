"""
Utility functions for MIDAS system
"""

import os
import sys
import logging
import random
import numpy as np
import torch
import psutil
from datetime import datetime
from pathlib import Path
from typing import Optional

def setup_logging(logs_dir: Path, project_name: str) -> logging.Logger:
    """
    Configures the logger for the project.
    
    Args:
        logs_dir: Directory to save log files
        project_name: Name of the project for logging
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(project_name)
    logger.setLevel(logging.INFO)
    
    # Clear existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()
    
    # File handler
    log_file = logs_dir / f"{project_name}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log"
    file_handler = logging.FileHandler(log_file)
    file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = logging.Formatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    return logger

def set_seed(seed: int = 42) -> None:
    """
    Sets random seeds for reproducibility across libraries.
    
    Args:
        seed: Random seed value
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    os.environ['PYTHONHASHSEED'] = str(seed)

def get_system_info() -> dict:
    """
    Get system information including CPU, GPU, and memory.
    
    Returns:
        Dictionary containing system information
    """
    info = {
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "cpu_count": psutil.cpu_count(),
        "memory_total_gb": psutil.virtual_memory().total / 1e9,
        "memory_available_gb": psutil.virtual_memory().available / 1e9
    }
    
    if torch.cuda.is_available():
        info["gpu_name"] = torch.cuda.get_device_name(0)
        info["gpu_memory_gb"] = torch.cuda.get_device_properties(0).total_memory / 1e9
        info["cuda_version"] = torch.version.cuda
    
    return info

def log_system_info(logger: logging.Logger) -> None:
    """
    Log system information.
    
    Args:
        logger: Logger instance
    """
    info = get_system_info()
    logger.info("=" * 50)
    logger.info("MIDAS V1: Multi-Modal Intelligent Dermoscopy Analysis System")
    logger.info(f"Project running on device: {info['device']}")
    
    if info['device'] == 'cuda':
        logger.info(f"GPU: {info['gpu_name']}")
        logger.info(f"GPU Memory: {info['gpu_memory_gb']:.2f} GB")
        logger.info(f"CUDA Version: {info['cuda_version']}")
    
    logger.info(f"System RAM: {info['memory_total_gb']:.2f} GB | Available: {info['memory_available_gb']:.2f} GB")
    logger.info(f"CPU Cores: {info['cpu_count']}")
    logger.info("=" * 50)

def ensure_dir(path: Path) -> None:
    """
    Ensure directory exists, create if not.
    
    Args:
        path: Path to directory
    """
    path.mkdir(parents=True, exist_ok=True)

def get_timestamp() -> str:
    """
    Get current timestamp string.
    
    Returns:
        Timestamp string in format YYYYMMDD_HHMMSS
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")
