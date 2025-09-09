"""
MIDAS V1: Multi-Modal Skin Cancer Detection System
Main entry point
"""

import argparse
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from src.config.config import MIDASConfig
from src.utils.helpers import setup_logging, set_seed, log_system_info
from src.data.dataloader import DataManager
from src.models.model import ModelFactory

def main():
    """Main function to run MIDAS system."""
    
    parser = argparse.ArgumentParser(description="MIDAS - Skin Cancer Detection System")
    parser.add_argument("--mode", choices=["train", "api", "test"], default="api",
                       help="Mode to run the system in")
    parser.add_argument("--model", default="efficientnet_b0",
                       help="Model architecture to use")
    parser.add_argument("--epochs", type=int, default=50,
                       help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32,
                       help="Batch size for training")
    parser.add_argument("--lr", type=float, default=0.001,
                       help="Learning rate")
    
    args = parser.parse_args()
    
    # Initialize configuration
    config = MIDASConfig()
    config.num_epochs = args.epochs
    config.batch_size = args.batch_size
    config.learning_rate = args.lr
    
    # Setup logging
    logger = setup_logging(config.logs_dir, config.project_name)
    
    # Set random seed
    set_seed(config.seed)
    logger.info(f"Random seed set to {config.seed}")
    
    # Log system information
    log_system_info(logger)
    
    if args.mode == "api":
        # Run API server
        logger.info("Starting API server...")
        import uvicorn
        from src.api.inference_api import app
        
        uvicorn.run(
            app,
            host=config.api_host,
            port=config.api_port,
            log_level="info"
        )
    
    elif args.mode == "train":
        # Training mode (to be implemented)
        logger.info("Training mode - To be implemented")
        logger.info(f"Model: {args.model}")
        logger.info(f"Epochs: {config.num_epochs}")
        logger.info(f"Batch Size: {config.batch_size}")
        logger.info(f"Learning Rate: {config.learning_rate}")
        
        # Initialize data manager
        data_manager = DataManager(config, logger)
        
        # Load datasets
        logger.info("Loading datasets...")
        ham10000 = data_manager.load_ham10000()
        if ham10000:
            logger.info(f"HAM10000 loaded: {ham10000.get('image_count', 0)} images")
        
        # Create model
        model = ModelFactory.create_model(
            model_name=args.model,
            num_classes=config.num_classes,
            pretrained=True
        )
        
        model_info = ModelFactory.get_model_info(args.model)
        logger.info(f"Model created: {model_info}")
        
        logger.info("Training pipeline ready. Implementation needed for full training loop.")
    
    elif args.mode == "test":
        # Test mode
        logger.info("Test mode - Running system checks...")
        
        # Test imports
        logger.info("✓ All imports successful")
        
        # Test configuration
        logger.info(f"✓ Configuration loaded: {config.project_name}")
        
        # Test data manager
        data_manager = DataManager(config, logger)
        logger.info("✓ Data manager initialized")
        
        # Test model creation
        model = ModelFactory.create_model("efficientnet_b0")
        logger.info("✓ Model creation successful")
        
        logger.info("All system checks passed!")
    
    logger.info("MIDAS system execution complete")

if __name__ == "__main__":
    main()
