"""Embedding service for document and query vectorization."""
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np
from app.config import settings


class EmbeddingService:
    """Service for generating embeddings using sentence transformers."""
    
    def __init__(self):
        """Initialize the embedding model."""
        self.model = None
        self.model_name = settings.embedding_model
        
    def load_model(self):
        """Load the sentence transformer model."""
        if self.model is None:
            print(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            print("Embedding model loaded successfully")
    
    def embed_text(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text.
        
        Args:
            text: Input text to embed
            
        Returns:
            numpy array of embeddings
        """
        if self.model is None:
            self.load_model()
        return self.model.encode(text, convert_to_numpy=True)
    
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of input texts to embed
            
        Returns:
            numpy array of embeddings
        """
        if self.model is None:
            self.load_model()
        return self.model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
    
    def get_dimension(self) -> int:
        """Get the embedding dimension."""
        if self.model is None:
            self.load_model()
        return self.model.get_sentence_embedding_dimension()


# Global embedding service instance
embedding_service = EmbeddingService()
