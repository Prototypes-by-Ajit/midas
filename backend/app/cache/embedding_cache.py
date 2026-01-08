"""Embedding cache layer."""
import hashlib
import numpy as np
from typing import Optional
import logging

from app.cache.cache_manager import cache_manager

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """Cache for text embeddings."""
    
    def __init__(self, ttl: int = 604800):  # 7 days default
        """
        Initialize embedding cache.
        
        Args:
            ttl: Time to live in seconds (default: 7 days)
        """
        self.ttl = ttl
        self.namespace = "embedding"
    
    def _compute_key(self, text: str, model_version: str) -> str:
        """
        Compute cache key for embedding.
        
        Args:
            text: Input text
            model_version: Embedding model version
            
        Returns:
            Cache key
        """
        return cache_manager.compute_key(text, model_version)
    
    def get(self, text: str, model_version: str) -> Optional[np.ndarray]:
        """
        Get cached embedding.
        
        Args:
            text: Input text
            model_version: Embedding model version
            
        Returns:
            Embedding array or None if not cached
        """
        key = self._compute_key(text, model_version)
        cached = cache_manager.get(key, namespace=self.namespace)
        
        if cached is not None:
            cache_manager.record_hit("embedding")
            logger.debug(f"Embedding cache hit for text (len={len(text)})")
            return cached
        
        cache_manager.record_miss("embedding")
        return None
    
    def set(self, text: str, model_version: str, embedding: np.ndarray) -> bool:
        """
        Cache an embedding.
        
        Args:
            text: Input text
            model_version: Embedding model version
            embedding: Embedding array
            
        Returns:
            True if successful, False otherwise
        """
        key = self._compute_key(text, model_version)
        success = cache_manager.set(key, embedding, ttl=self.ttl, namespace=self.namespace)
        
        if success:
            logger.debug(f"Embedding cached for text (len={len(text)})")
        
        return success
    
    def get_batch(self, texts: list[str], model_version: str) -> list[Optional[np.ndarray]]:
        """
        Get multiple cached embeddings.
        
        Args:
            texts: List of input texts
            model_version: Embedding model version
            
        Returns:
            List of embeddings (None for cache misses)
        """
        return [self.get(text, model_version) for text in texts]
    
    def set_batch(self, texts: list[str], model_version: str, embeddings: list[np.ndarray]) -> int:
        """
        Cache multiple embeddings.
        
        Args:
            texts: List of input texts
            model_version: Embedding model version
            embeddings: List of embedding arrays
            
        Returns:
            Number of successfully cached embeddings
        """
        count = 0
        for text, embedding in zip(texts, embeddings):
            if self.set(text, model_version, embedding):
                count += 1
        return count
    
    def invalidate_model(self, model_version: str) -> int:
        """
        Invalidate all embeddings for a model version.
        
        Args:
            model_version: Model version to invalidate
            
        Returns:
            Number of keys deleted
        """
        pattern = f"*{model_version}*"
        deleted = cache_manager.invalidate_pattern(pattern, namespace=self.namespace)
        logger.info(f"Invalidated {deleted} embeddings for model {model_version}")
        return deleted


# Global instance
embedding_cache = EmbeddingCache()
