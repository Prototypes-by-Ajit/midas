"""Cache module with multi-layer caching."""
from app.cache.cache_manager import cache_manager, init_cache, close_cache

__all__ = [
    "cache_manager",
    "init_cache",
    "close_cache",
]
