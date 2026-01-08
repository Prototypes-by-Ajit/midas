"""FastAPI application - Router-based Multi-Agent Architecture."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
import logging

from app.config import settings
from app.main_orchestrator import main_orchestrator
from app.services.supabase_vector_store import supabase_vector_store
from app.services.embeddings import embedding_service
from app.services.tavily_service import tavily_service
from app.mcp.tools import tool_registry

logger = logging.getLogger(__name__)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class QueryRequest(BaseModel):
    """Request model for chat queries."""
    query: str
    lesion_class: Optional[str] = None
    user_id: Optional[str] = None


# ============================================================================
# LIFESPAN MANAGER
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app."""
    # Startup
    print("\\n" + "="*80)
    print("🚀 MIDAS RAG - ROUTER-BASED MULTI-AGENT ARCHITECTURE".center(80))
    print("="*80)
    
    components_status = {}
    
    # 1. Supabase Vector Store
    print("\\n📊 Initializing Supabase vector store...")
    if supabase_vector_store.initialize():
        components_status["supabase"] = "✅ Connected"
        stats = await supabase_vector_store.get_document_stats()
        print(f"   Documents: {stats.get('total_documents', 0)}")
        print(f"   Embeddings: {stats.get('total_embeddings', 0)}")
    else:
        components_status["supabase"] = "⚠️  Not configured"
    
    # 2. Embedding Service
    print("\\n🔤 Initializing embedding service...")
    try:
        embedding_service.load_model()
        components_status["embeddings"] = "✅ Ready"
    except Exception as e:
        components_status["embeddings"] = f"❌ Failed: {e}"
    
    # 3. Groq LLM
    print("\\n🤖 Checking Groq LLM...")
    if settings.groq_api_key:
        components_status["groq"] = "✅ Configured"
        print(f"   Model: {settings.groq_model}")
    else:
        components_status["groq"] = "❌ API key missing"
    
    # 4. Tavily MCP
    print("\\n🔍 Checking Tavily MCP...")
    if tavily_service.is_configured():
        components_status["tavily_mcp"] = "✅ Configured (Web Scraping Agent)"
    else:
        components_status["tavily_mcp"] = "⚠️  Not configured"
    
    # 5. MCP Tools
    print("\\n🛠️  Initializing MCP tools...")
    tools = tool_registry.list_tools()
    components_status["mcp_tools"] = f"✅ {len(tools)} tools registered"
    
    # Summary
    print("\\n" + "-"*80)
    print("📋 COMPONENT STATUS".center(80))
    print("-"*80)
    for component, status in components_status.items():
        print(f"   {component.ljust(20)}: {status}")
    print("-"*80)
    
    print("\\n✅ MIDAS Multi-Agent System is READY!")
    print(f"🌐 API: http://localhost:{settings.api_port}")
    print(f"📚 Docs: http://localhost:{settings.api_port}/docs")
    print(f"🎯 Architecture: Router → RAG Agent | Web Scraping Agent\\n")
    
    yield
    
    # Shutdown
    print("\\n\\n👋 Shutting down MIDAS Multi-Agent System...")


# ============================================================================
# CREATE APP
# ============================================================================

app = FastAPI(
    title="MIDAS Multi-Agent RAG API",
    description="Medical AI Assistant - Router-based Multi-Agent Architecture",
    version="3.0.0",
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


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MIDAS Multi-Agent RAG API",
        "version": "3.0.0",
        "status": "running",
        "architecture": "router_based",
        "agents": ["router", "rag_agent", "web_scraping_agent"],
        "docs": "/docs"
    }


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    stats = await supabase_vector_store.get_document_stats() if supabase_vector_store.is_ready() else {}
    
    return {
        "status": "healthy",
        "mode": "multi_agent",
        "architecture": "router_based",
        "components": {
            "supabase": supabase_vector_store.is_ready(),
            "groq": bool(settings.groq_api_key),
            "embeddings": True,
            "tavily_mcp": tavily_service.is_configured(),
            "mcp_tools": len(tool_registry.list_tools())
        },
        "vector_store": stats if stats else {"status": "not_configured"},
        "agents": {
            "router_agent": "active",
            "rag_agent": "active",
            "web_scraping_agent": "active" if tavily_service.is_configured() else "inactive"
        }
    }


@app.post("/api/v1/sessions/{session_id}/messages")
async def create_message(session_id: str, request: QueryRequest):
    """
    Create message via multi-agent orchestrator.
    
    Routing:
    - Query with URL → Web Scraping Agent (Tavily MCP)
    - Query without URL → RAG Agent (Vector Store + LLM)
    """
    try:
        response = await main_orchestrator.process_query(
            query=request.query,
            session_id=session_id,
            user_id=request.user_id,
            lesion_class=request.lesion_class
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_agent:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
