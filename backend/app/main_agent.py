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
from app.services.chat_persistence import chat_persistence
from app.mcp.tools import tool_registry
from app.api.document_processing import router as document_processing_router
from app.api.reports import router as reports_router
from app.api.image_analysis import router as image_analysis_router

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

# Include routers
app.include_router(document_processing_router, prefix="/api/v1", tags=["document-processing"])
app.include_router(reports_router, prefix="/api/v1", tags=["reports"])
app.include_router(image_analysis_router, prefix="/api/v1", tags=["image-analysis"])


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


@app.get("/api/v1/sessions/{session_id}/messages")
async def get_messages(session_id: str, limit: int = 50, offset: int = 0, user_id: str = None):
    """
    Get messages for a session (paginated).

    Security: Validates that the user_id in the query matches messages in the session.
    """
    try:
        messages = await chat_persistence.get_session_messages(session_id, limit, offset)

        # Security check: Verify user owns this session
        if user_id and messages:
            # Check if any message in this session belongs to the requesting user
            session_user_ids = {msg.get('user_id') for msg in messages if msg.get('user_id')}
            if session_user_ids and user_id not in session_user_ids:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You don't have permission to access this session"
                )

        total = await chat_persistence.get_session_count(session_id)

        return {
            "session_id": session_id,
            "messages": messages,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@app.post("/api/v1/sessions/{session_id}/messages")
async def create_message(session_id: str, request: QueryRequest):
    """
    Create message via multi-agent orchestrator.

    Routing:
    - Query with URL → Web Scraping Agent (Tavily MCP)
    - Query without URL → RAG Agent (Vector Store + LLM)
    """
    try:
        # Save user message to database
        await chat_persistence.save_message(
            session_id=session_id,
            role="user",
            content=request.query,
            user_id=request.user_id
        )

        # Process query through orchestrator
        response = await main_orchestrator.process_query(
            query=request.query,
            session_id=session_id,
            user_id=request.user_id,
            lesion_class=request.lesion_class
        )

        # Save assistant response to database
        await chat_persistence.save_message(
            session_id=session_id,
            role="assistant",
            content=response.get("answer", ""),
            user_id=request.user_id,
            citations=response.get("citations", []),
            confidence=response.get("confidence"),
            route=response.get("route")
        )

        return response

    except Exception as e:
        logger.error(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/documents/{document_id}/process")
async def process_document_embeddings(document_id: str, request: dict):
    """
    Process document and create embeddings.
    Called by Supabase Edge Function after document upload.

    Args:
        document_id: UUID of the document in database
        request: { storage_path (optional), bucket (optional) }
    """
    try:
        from app.services.supabase_vector_store import supabase_vector_store
        from app.utils.supabase_storage import SupabaseStorageLoader
        from app.services.embeddings import embedding_service
        from supabase import create_client

        logger.info(f"Processing document: {document_id}")

        # Initialize Supabase client
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )

        # Get document record
        doc_result = supabase.table('documents').select('*').eq('id', document_id).single().execute()

        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = doc_result.data
        storage_path = doc.get('storage_path')

        if not storage_path:
            raise HTTPException(status_code=400, detail="Document has no storage_path")

        # If content is already extracted, just create embeddings
        if doc.get('content') and len(doc['content']) > 50:
            text_content = doc['content']
            logger.info(f"Using existing content: {len(text_content)} chars")
        else:
            # Extract text from storage
            logger.info(f"Extracting text from storage: {storage_path}")
            storage_loader = SupabaseStorageLoader(bucket_name="Multiagent_Skincancer_RAG")
            text_content = storage_loader.extract_text(storage_path)

            if not text_content or len(text_content.strip()) < 50:
                logger.warning(f"Text too short: {len(text_content or '')} chars")
                supabase.table('documents').update({
                    'status': 'failed',
                    'content': text_content or ''
                }).eq('id', document_id).execute()

                raise HTTPException(status_code=400, detail="Extracted text too short")

            # Update document with content
            supabase.table('documents').update({
                'content': text_content
            }).eq('id', document_id).execute()

            logger.info(f"Extracted {len(text_content)} characters")

        # Initialize services if needed
        if not supabase_vector_store.is_ready():
            supabase_vector_store.initialize()

        if not hasattr(embedding_service, 'model') or embedding_service.model is None:
            embedding_service.load_model()

        # Create embeddings
        logger.info("Creating embeddings...")
        chunks = supabase_vector_store._chunk_text(text_content, chunk_size=500)
        logger.info(f"Created {len(chunks)} chunks")

        embedding_records = []
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embedding_service.embed_text(chunk)

            embedding_records.append({
                "document_id": document_id,
                "embedding": embedding.tolist(),
                "chunk_text": chunk,
                "chunk_index": i,
                "chunk_size": len(chunk),
                "model_version": "all-MiniLM-L6-v2"
            })

        # Batch insert embeddings
        if embedding_records:
            supabase_vector_store.client.table("embeddings").insert(embedding_records).execute()
            logger.info(f"Created {len(embedding_records)} embeddings")

        # Update document status to processed
        supabase.table('documents').update({
            'status': 'processed'
        }).eq('id', document_id).execute()

        logger.info(f"✅ Document {document_id} processed successfully")

        return {
            "success": True,
            "document_id": document_id,
            "chunks_created": len(chunks),
            "embeddings_created": len(embedding_records),
            "status": "processed"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_agent:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
