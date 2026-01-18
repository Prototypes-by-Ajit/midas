"""Embedding service for document and query vectorization."""
from typing import List
import numpy as np
import httpx
from app.config import settings


class EmbeddingService:
    """Service for generating embeddings using sentence transformers."""
    
    def __init__(self):
        """Initialize the embedding model."""
        self.model = None
        self.model_name = settings.embedding_model
        self.provider = settings.embedding_provider
        self.api_url = settings.embedding_api_url
        self.api_key = settings.embedding_api_key
        self.api_model = settings.embedding_api_model or self.model_name
        
    def load_model(self):
        """Load the sentence transformer model."""
        if self.provider != "local":
            if self.model is None:
                print(f"Using hosted embedding provider: {self.provider}")
                self.model = "hosted"
            return
        if self.model is None:
            print(f"Loading embedding model: {self.model_name}")
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            print("Embedding model loaded successfully")

    def _require_api_config(self) -> None:
        if not self.api_url or not self.api_key:
            raise ValueError("Hosted embeddings require EMBEDDING_API_URL and EMBEDDING_API_KEY")

    def _embed_remote(self, texts: List[str]) -> np.ndarray:
        self._require_api_config()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.api_model,
            "input": texts
        }
        response = httpx.post(self.api_url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        embeddings = [item["embedding"] for item in data.get("data", [])]
        if not embeddings:
            raise ValueError("No embeddings returned from hosted provider")
        return np.asarray(embeddings, dtype=np.float32)
    
    def embed_text(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text.
        
        Args:
            text: Input text to embed
            
        Returns:
            numpy array of embeddings
        """
        if self.provider != "local":
            return self._embed_remote([text])[0]
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
        if self.provider != "local":
            return self._embed_remote(texts)
        if self.model is None:
            self.load_model()
        return self.model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
    
    def get_dimension(self) -> int:
        """Get the embedding dimension."""
        if self.provider != "local":
            return settings.embedding_dimension
        if self.model is None:
            self.load_model()
        return self.model.get_sentence_embedding_dimension()


# Global embedding service instance
embedding_service = EmbeddingService()
