"""Initialize database and cache for MIDAS Enhanced RAG."""
import sys
from app.db import init_database, db_manager
from app.cache import init_cache, cache_manager
from app.config import settings

def main():
    """Initialize database and cache."""
    print("=" * 60)
    print("MIDAS Enhanced RAG - Database & Cache Initialization")
    print("=" * 60)
    
    # 1. Initialize Database
    print("\n[1/3] Initializing Database...")
    try:
        init_database(settings.database_url, create_tables=True)
        
        if db_manager.health_check():
            print("  ✅ Database connected successfully!")
            pool_status = db_manager.get_pool_status()
            print(f"  ℹ️  Pool size: {pool_status['size']}, Total: {pool_status['total']}")
        else:
            print("  ❌ Database health check failed!")
            sys.exit(1)
    except Exception as e:
        print(f"  ❌ Database initialization failed: {e}")
        sys.exit(1)
    
    # 2. Initialize Cache
    print("\n[2/3] Initializing Redis Cache...")
    try:
        init_cache(
            redis_url=settings.redis_url,
            password=settings.redis_password,
            max_connections=settings.redis_max_connections
        )
        
        if cache_manager.health_check():
            print("  ✅ Redis connected successfully!")
            redis_info = cache_manager.get_info()
            print(f"  ℹ️  Keys: {redis_info.get('total_keys', 0)}, "
                  f"Memory: {redis_info.get('used_memory_human', 'N/A')}")
        else:
            print("  ❌ Redis health check failed!")
            sys.exit(1)
    except Exception as e:
        print(f"  ❌ Redis initialization failed: {e}")
        sys.exit(1)
    
    # 3. Display Configuration
    print("\n[3/3] Configuration Summary")
    print("-" * 60)
    print(f"  Database URL: {settings.database_url.split('@')[1] if '@' in settings.database_url else settings.database_url}")
    print(f"  Redis URL: {settings.redis_url}")
    print(f"  Doc Index Version: {settings.doc_index_version}")
    print(f"  LLM Version: {settings.llm_version}")
    print(f"  Embedding Model: {settings.embedding_model_version}")
    print(f"  CLARA Enabled: {settings.use_clara_architecture}")
    print(f"  Caching Enabled: {settings.enable_caching}")
    print(f"  Grounding Verification: {settings.enable_grounding_verification}")
    print(f"  Lesion Classes: {', '.join(settings.lesion_classes_list)}")
    
    # Success!
    print("\n" + "=" * 60)
    print("✅ Initialization Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Build vector index: python -m app.scripts.build_index")
    print("  2. Start server: uvicorn app.main_agent:app --reload --port 8001")
    print("  3. Test: curl http://localhost:8001/api/v1/health")
    print()

if __name__ == "__main__":
    main()
