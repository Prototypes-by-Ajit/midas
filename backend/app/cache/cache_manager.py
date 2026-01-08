"""Central cache manager with Redis and versioning."""
import redis
import hashlib
import json
import pickle
from typing import Any, Optional, Dict
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class CacheManager:
    """Central cache coordinator with versioning and metrics."""
    
    def __init__(
        self,
        redis_url: str,
        password: Optional[str] = None,
        max_connections: int = 50
    ):
        """
        Initialize cache manager.
        
        Args:
            redis_url: Redis connection URL
            password: Redis password (optional)
            max_connections: Maximum connection pool size
        """
        self.redis_url = redis_url
        self.password = password
        self.max_connections = max_connections
        self.client: Optional[redis.Redis] = None
        
        # Metrics
        self.metrics = {
            "embedding_hits": 0,
            "embedding_misses": 0,
            "retrieval_hits": 0,
            "retrieval_misses": 0,
            "rerank_hits": 0,
            "rerank_misses": 0,
            "generation_hits": 0,
            "generation_misses": 0,
            "tool_hits": 0,
            "tool_misses": 0,
        }
        
    def connect(self):
        """Establish Redis connection."""
        try:
            self.client = redis.from_url(
                self.redis_url,
                password=self.password,
                max_connections=self.max_connections,
                decode_responses=False,  # We'll handle encoding ourselves
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Test connection
            self.client.ping()
            logger.info(f"Redis connected successfully (max_connections={self.max_connections})")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def health_check(self) -> bool:
        """
        Check Redis connectivity.
        
        Returns:
            True if Redis is accessible, False otherwise
        """
        if self.client is None:
            return False
        try:
            return self.client.ping()
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get Redis server info.
        
        Returns:
            Dictionary with Redis statistics
        """
        if self.client is None:
            return {"status": "not_connected"}
        try:
            info = self.client.info()
            return {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "total_keys": self.client.dbsize(),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
            }
        except Exception as e:
            logger.error(f"Failed to get Redis info: {e}")
            return {"status": "error", "error": str(e)}
    
    def compute_key(self, *components: str) -> str:
        """
        Compute cache key from components.
        
        Args:
            *components: Key components to hash
            
        Returns:
            Hashed cache key
        """
        combined = ":".join(str(c) for c in components)
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        namespace: str = "cache"
    ) -> bool:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache (will be pickled)
            ttl: Time to live in seconds
            namespace: Cache namespace prefix
            
        Returns:
            True if successful, False otherwise
        """
        if self.client is None:
            logger.warning("Redis not connected, skipping cache set")
            return False
        
        try:
            full_key = f"{namespace}:{key}"
            serialized_value = pickle.dumps(value)
            
            if ttl:
                self.client.setex(full_key, ttl, serialized_value)
            else:
                self.client.set(full_key, serialized_value)
            
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def get(self, key: str, namespace: str = "cache") -> Optional[Any]:
        """
        Get a value from cache.
        
        Args:
            key: Cache key
            namespace: Cache namespace prefix
            
        Returns:
            Cached value or None if not found
        """
        if self.client is None:
            return None
        
        try:
            full_key = f"{namespace}:{key}"
            value = self.client.get(full_key)
            
            if value is None:
                return None
            
            return pickle.loads(value)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    def exists(self, key: str, namespace: str = "cache") -> bool:
        """
        Check if key exists in cache.
        
        Args:
            key: Cache key
            namespace: Cache namespace prefix
            
        Returns:
            True if key exists, False otherwise
        """
        if self.client is None:
            return False
        
        try:
            full_key = f"{namespace}:{key}"
            return self.client.exists(full_key) > 0
        except Exception as e:
            logger.error(f"Cache exists check error: {e}")
            return False
    
    def delete(self, key: str, namespace: str = "cache") -> bool:
        """
        Delete a key from cache.
        
        Args:
            key: Cache key
            namespace: Cache namespace prefix
            
        Returns:
            True if successful, False otherwise
        """
        if self.client is None:
            return False
        
        try:
            full_key = f"{namespace}:{key}"
            self.client.delete(full_key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def invalidate_pattern(self, pattern: str, namespace: str = "cache") -> int:
        """
        Invalidate all keys matching pattern.
        
        Args:
            pattern: Pattern to match (e.g., "*embedding*")
            namespace: Cache namespace prefix
            
        Returns:
            Number of keys deleted
        """
        if self.client is None:
            return 0
        
        try:
            full_pattern = f"{namespace}:{pattern}"
            keys = self.client.keys(full_pattern)
            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"Invalidated {deleted} keys matching pattern: {full_pattern}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
            return 0
    
    def invalidate_version(self, version_key: str) -> int:
        """
        Invalidate all caches for a specific version.
        
        Args:
            version_key: Version identifier (e.g., "doc_index_v1.0.0")
            
        Returns:
            Number of keys deleted
        """
        return self.invalidate_pattern(f"*{version_key}*")
    
    def flush_all(self) -> bool:
        """
        Flush entire cache database. Use with caution!
        
        Returns:
            True if successful, False otherwise
        """
        if self.client is None:
            return False
        
        try:
            self.client.flushdb()
            logger.warning("Cache database flushed")
            return True
        except Exception as e:
            logger.error(f"Cache flush error: {e}")
            return False
    
    def record_hit(self, cache_type: str):
        """Record a cache hit for metrics."""
        metric_key = f"{cache_type}_hits"
        if metric_key in self.metrics:
            self.metrics[metric_key] += 1
    
    def record_miss(self, cache_type: str):
        """Record a cache miss for metrics."""
        metric_key = f"{cache_type}_misses"
        if metric_key in self.metrics:
            self.metrics[metric_key] += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get cache metrics.
        
        Returns:
            Dictionary with cache hit/miss statistics
        """
        total_hits = sum(v for k, v in self.metrics.items() if k.endswith("_hits"))
        total_misses = sum(v for k, v in self.metrics.items() if k.endswith("_misses"))
        total_requests = total_hits + total_misses
        
        hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self.metrics,
            "total_hits": total_hits,
            "total_misses": total_misses,
            "total_requests": total_requests,
            "hit_rate_percent": round(hit_rate, 2),
            "per_cache_hit_rates": {
                cache_type: round(
                    (self.metrics[f"{cache_type}_hits"] / 
                     (self.metrics[f"{cache_type}_hits"] + self.metrics[f"{cache_type}_misses"]) * 100)
                    if (self.metrics[f"{cache_type}_hits"] + self.metrics[f"{cache_type}_misses"]) > 0 
                    else 0,
                    2
                )
                for cache_type in ["embedding", "retrieval", "rerank", "generation", "tool"]
            }
        }
    
    def reset_metrics(self):
        """Reset all cache metrics."""
        for key in self.metrics:
            self.metrics[key] = 0
        logger.info("Cache metrics reset")
    
    def close(self):
        """Close Redis connection."""
        if self.client is not None:
            self.client.close()
            logger.info("Redis connection closed")
            self.client = None


# Global cache manager instance
cache_manager = CacheManager(
    redis_url="",  # Will be set from config
    password=None,
    max_connections=50
)


def init_cache(redis_url: str, password: Optional[str] = None, max_connections: int = 50):
    """
    Initialize the cache manager.
    
    Args:
        redis_url: Redis connection URL
        password: Redis password (optional)
        max_connections: Maximum connection pool size
    """
    global cache_manager
    cache_manager.redis_url = redis_url
    cache_manager.password = password
    cache_manager.max_connections = max_connections
    cache_manager.connect()
    logger.info("Cache manager initialized successfully")


def close_cache():
    """Close cache connections."""
    global cache_manager
    cache_manager.close()
