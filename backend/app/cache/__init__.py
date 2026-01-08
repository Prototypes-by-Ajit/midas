"""Cache module with multi-layer caching."""
from app.cache.cache_manager import cache_manager, init_cache, close_cache
from app.cache.embedding_cache import embedding_cache, EmbeddingCache
from app.cache.retrieval_cache import retrieval_cache, RetrievalCache
from app.cache.generation_cache import generation_cache, GenerationCache

__all__ = [
    "cache_manager",
    "init_cache",
    "close_cache",
    "embedding_cache",
    "EmbeddingCache",
    "retrieval_cache",
    "RetrievalCache",
    "generation_cache",
    "GenerationCache",
]
