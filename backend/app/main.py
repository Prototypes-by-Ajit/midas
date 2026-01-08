"""FastAPI application for MIDAS Agentic RAG backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.api.routes import router
from app.services.vector_store import vector_store
from app.services.embeddings import embedding_service
from app.cache.cache_manager import init_cache, close_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app."""
    # Startup
    print("🚀 Starting MIDAS RAG Backend...")
    print(f"   Ollama URL: {settings.ollama_base_url}")
    print(f"   Model: {settings.ollama_model}")
    
    # Load embedding model
    print("\n📦 Loading embedding model...")
    embedding_service.load_model()
    
    # Initialize Redis cache
    if settings.enable_caching:
        print("\n💾 Connecting to Redis cache...")
        try:
            init_cache(redis_url=settings.redis_url)
            print("   ✅ Redis cache connected")
        except Exception as e:
            print(f"   ⚠️  Redis connection failed: {e}")
            print("   Continuing without cache...")
    
    # Load vector store
    print(f"\n🗄️  Loading vector store from {settings.vector_db_path}...")
    loaded = vector_store.load_index()
    if loaded:
        print(f"   ✅ Vector store loaded: {vector_store.index.ntotal} documents")
    else:
        print("   ⚠️  Vector store not found. Please build the index first.")
        print("   Run: python -m app.scripts.build_index")
    
    print("\n✅ MIDAS RAG Backend started successfully!")
    print(f"   API available at: http://{settings.api_host}:{settings.api_port}")
    print(f"   Docs at: http://{settings.api_host}:{settings.api_port}/docs\n")
    
    yield
    
    # Shutdown
    print("\n👋 Shutting down MIDAS RAG Backend...")
    if settings.enable_caching:
        close_cache()
        print("   Redis cache closed")


# Create FastAPI app
app = FastAPI(
    title="MIDAS Agentic RAG API",
    description="Medical AI Assistant for skin cancer education with strict domain scoping",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MIDAS Agentic RAG API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
