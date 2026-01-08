"""Generation cache layer (evidence-bound)."""
from typing import Optional, List, Dict, Any
import json
import logging

from app.cache.cache_manager import cache_manager

logger = logging.getLogger(__name__)


class GenerationCache:
    """Cache for LLM generation results (only if grounded)."""
    
    def __init__(self, ttl: int = 86400):  # 24 hours default
        """
        Initialize generation cache.
        
        Args:
            ttl: Time to live in seconds (default: 24 hours)
        """
        self.ttl = ttl
        self.namespace = "generation"
    
    def _compute_key(
        self,
        system_prompt: str,
        query: str,
        evidence_ids: List[str],
        llm_version: str,
        doc_index_version: str,
        response_mode: str = "default"
    ) -> str:
        """
        Compute cache key for generation.
        
        Args:
            system_prompt: System prompt used
            query: User query
            evidence_ids: List of evidence chunk IDs used
            llm_version: LLM model version
            doc_index_version: Document index version
            response_mode: Response mode (e.g., 'simple', 'detailed')
            
        Returns:
            Cache key
        """
        # Sort evidence IDs for consistency
        sorted_evidence = sorted(evidence_ids)
        evidence_str = json.dumps(sorted_evidence)
        
        return cache_manager.compute_key(
            system_prompt[:100],  # Truncate prompt for key
            query,
            evidence_str,
            llm_version,
            doc_index_version,
            response_mode
        )
    
    def get(
        self,
        system_prompt: str,
        query: str,
        evidence_ids: List[str],
        llm_version: str,
        doc_index_version: str,
        response_mode: str = "default"
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached generation result.
        
        Args:
            system_prompt: System prompt used
            query: User query
            evidence_ids: List of evidence chunk IDs
            llm_version: LLM model version
            doc_index_version: Document index version
            response_mode: Response mode
            
        Returns:
            Cached response with citations or None if not cached
        """
        key = self._compute_key(
            system_prompt, query, evidence_ids, 
            llm_version, doc_index_version, response_mode
        )
        cached = cache_manager.get(key, namespace=self.namespace)
        
        if cached is not None:
            cache_manager.record_hit("generation")
            logger.debug(f"Generation cache hit for query: {query[:50]}...")
            return cached
        
        cache_manager.record_miss("generation")
        return None
    
    def set(
        self,
        system_prompt: str,
        query: str,
        evidence_ids: List[str],
        llm_version: str,
        doc_index_version: str,
        response: str,
        citations: List[Dict[str, Any]],
        grounding_passed: bool,
        response_mode: str = "default"
    ) -> bool:
        """
        Cache generation result (ONLY if grounding passed).
        
        Args:
            system_prompt: System prompt used
            query: User query
            evidence_ids: List of evidence chunk IDs
            llm_version: LLM model version
            doc_index_version: Document index version
            response: Generated response
            citations: Citations used
            grounding_passed: Whether grounding verification passed
            response_mode: Response mode
            
        Returns:
            True if successful, False otherwise
        """
        # CRITICAL: Only cache if grounding passed
        if not grounding_passed:
            logger.warning(f"Refusing to cache ungrounded response for query: {query[:50]}...")
            return False
        
        key = self._compute_key(
            system_prompt, query, evidence_ids,
            llm_version, doc_index_version, response_mode
        )
        
        cache_data = {
            "response": response,
            "citations": citations,
            "grounding_passed": grounding_passed,
            "evidence_ids": evidence_ids
        }
        
        success = cache_manager.set(key, cache_data, ttl=self.ttl, namespace=self.namespace)
        
        if success:
            logger.debug(f"Generation result cached (grounded) for query: {query[:50]}...")
        
        return success
    
    def invalidate_llm(self, llm_version: str) -> int:
        """
        Invalidate all generations for an LLM version.
        
        Args:
            llm_version: LLM version to invalidate
            
        Returns:
            Number of keys deleted
        """
        pattern = f"*{llm_version}*"
        deleted = cache_manager.invalidate_pattern(pattern, namespace=self.namespace)
        logger.info(f"Invalidated {deleted} generations for LLM {llm_version}")
        return deleted
    
    def invalidate_index(self, doc_index_version: str) -> int:
        """
        Invalidate all generations for a document index version.
        
        Args:
            doc_index_version: Document index version to invalidate
            
        Returns:
            Number of keys deleted
        """
        pattern = f"*{doc_index_version}*"
        deleted = cache_manager.invalidate_pattern(pattern, namespace=self.namespace)
        logger.info(f"Invalidated {deleted} generations for index {doc_index_version}")
        return deleted


# Global instance
generation_cache = GenerationCache()
