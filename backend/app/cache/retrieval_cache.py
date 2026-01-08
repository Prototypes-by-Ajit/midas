"""Retrieval cache layer."""
from typing import Optional, List, Dict, Any
import json
import logging

from app.cache.cache_manager import cache_manager

logger = logging.getLogger(__name__)


class RetrievalCache:
    """Cache for retrieval results."""
    
    def __init__(self, ttl: int = 21600):  # 6 hours default
        """
        Initialize retrieval cache.
        
        Args:
            ttl: Time to live in seconds (default: 6 hours)
        """
        self.ttl = ttl
        self.namespace = "retrieval"
    
    def _compute_key(
        self, 
        query: str, 
        filters: Dict[str, Any], 
        doc_index_version: str,
        top_k: int
    ) -> str:
        """
        Compute cache key for retrieval.
        
        Args:
            query: Search query
            filters: Metadata filters (e.g., lesion_class)
            doc_index_version: Document index version
            top_k: Number of results
            
        Returns:
            Cache key
        """
        filters_str = json.dumps(filters, sort_keys=True)
        return cache_manager.compute_key(
            query, 
            filters_str, 
            doc_index_version,
            str(top_k)
        )
    
    def get(
        self, 
        query: str, 
        filters: Dict[str, Any], 
        doc_index_version: str,
        top_k: int
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached retrieval results.
        
        Args:
            query: Search query
            filters: Metadata filters
            doc_index_version: Document index version
            top_k: Number of results
            
        Returns:
            List of retrieved documents or None if not cached
        """
        key = self._compute_key(query, filters, doc_index_version, top_k)
        cached = cache_manager.get(key, namespace=self.namespace)
        
        if cached is not None:
            cache_manager.record_hit("retrieval")
            logger.debug(f"Retrieval cache hit for query: {query[:50]}...")
            return cached
        
        cache_manager.record_miss("retrieval")
        return None
    
    def set(
        self, 
        query: str, 
        filters: Dict[str, Any], 
        doc_index_version: str,
        top_k: int,
        results: List[Dict[str, Any]]
    ) -> bool:
        """
        Cache retrieval results.
        
        Args:
            query: Search query
            filters: Metadata filters
            doc_index_version: Document index version
            top_k: Number of results
            results: Retrieved documents with scores
            
        Returns:
            True if successful, False otherwise
        """
        key = self._compute_key(query, filters, doc_index_version, top_k)
        success = cache_manager.set(key, results, ttl=self.ttl, namespace=self.namespace)
        
        if success:
            logger.debug(f"Retrieval results cached for query: {query[:50]}...")
        
        return success
    
    def invalidate_index(self, doc_index_version: str) -> int:
        """
        Invalidate all retrievals for a document index version.
        
        Args:
            doc_index_version: Document index version to invalidate
            
        Returns:
            Number of keys deleted
        """
        pattern = f"*{doc_index_version}*"
        deleted = cache_manager.invalidate_pattern(pattern, namespace=self.namespace)
        logger.info(f"Invalidated {deleted} retrieval results for index {doc_index_version}")
        return deleted


# Global instance
retrieval_cache = RetrievalCache()
