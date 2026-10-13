"""FastAPI application - Router-based Multi-Agent Architecture."""
import time
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, make_asgi_app
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime
 
from app.config import settings, MEDICAL_DISCLAIMER
from app.main_orchestrator import main_orchestrator
from app.services.supabase_vector_store import supabase_vector_store
from app.services.embeddings import embedding_service
from app.services.tavily_service import tavily_service
from app.services.chat_persistence import chat_persistence
from app.api.document_processing import router as document_processing_router
from app.api.reports import router as reports_router
from app.api.image_analysis import router as image_analysis_router
from app.api.admin import router as admin_router
try:
    from openai import NotFoundError
except Exception:  # pragma: no cover - compatibility across OpenAI client versions
    class NotFoundError(Exception):
        """Fallback for environments where openai.NotFoundError is unavailable."""


logger = logging.getLogger(__name__)


def _get_request_path(request: Request) -> str:
    route = request.scope.get("route")
    if route and hasattr(route, "path"):
        return route.path
    return request.url.path


class QueryRequest(BaseModel):
    """Request model for chat queries."""
    query: str
    lesion_class: Optional[str] = None
    user_id: Optional[str] = None
    # Populated by the Next.js BFF from its own getSessionUser() call (T018).
    # Required for policy_block_events.subject_role NOT NULL (FR-AUD-4, eng
    # review Tension 2) to be satisfiable when the safety guardrail blocks a
    # query. Optional here so existing callers that don't send it still
    # construct successfully.
    subject_role: Optional[str] = None


def _build_provider_error_response(detail: str) -> dict:
    """Build a safe fallback response when LLM provider calls fail."""
    return {
        "answer": (
            "I’m currently unable to generate a final answer from my provider right now.\n"
            f"Details: {detail}\n\n"
            "I can still help with skin cancer and dermatology questions. "
            "Please retry with a shorter, clearer question or try again in a minute."
            f"{MEDICAL_DISCLAIMER}"
        ),
        "citations": [],
        "confidence": 0.0,
        "route": "provider_error",
        "model_used": "fallback",
        "mode": "provider_error",
        "confidence_breakdown": {
            "final_confidence": 0.0,
            "reason": "llm_provider_error"
        },
        "timestamp": datetime.utcnow().isoformat()
    }


async def _persist_assistant_fallback(
    session_id: str,
    user_id: Optional[str],
    response: dict,
) -> None:
    """Persist assistant fallback responses so the chat UI can render them like normal answers."""
    try:
        await chat_persistence.save_message(
            session_id=session_id,
            role="assistant",
            content=response.get("answer", ""),
            user_id=user_id,
            citations=response.get("citations", []),
            confidence=response.get("confidence"),
            route=response.get("route"),
            metadata={
                "model_used": response.get("model_used"),
                "mode": response.get("mode"),
                "confidence_breakdown": response.get("confidence_breakdown"),
            },
        )
    except Exception as persist_error:
        logger.error("Failed to persist assistant fallback response: %s", persist_error)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app."""
    # Startup
    print("\\n" + "="*80)
    print("🚀 MIDAS RAG - ROUTER-BASED MULTI-AGENT ARCHITECTURE".center(80))
    print("="*80)
    
    components_status = {}
    
    # 1. Supabase Vector Store
    # Initialized eagerly, not lazily: /readyz gates on is_ready(), which is only true
    # once initialize() has run. Leaving it to the first request deadlocks Kubernetes —
    # the readinessProbe never passes, so the Service has no endpoints, so no request
    # ever arrives to trigger the lazy init. initialize() only constructs a client (no
    # network call) and returns False rather than raising, so a Supabase outage leaves
    # the app up and correctly reporting not-ready instead of crash-looping.
    print("\\n📊 Initializing Supabase vector store...")
    if settings.supabase_url and settings.supabase_service_key:
        components_status["supabase"] = (
            "✅ Initialized"
            if supabase_vector_store.initialize()
            else "⚠️  Initialization failed (see logs)"
        )
    else:
        components_status["supabase"] = "⚠️  Not configured"

    # 2. Embedding Service
    print("\\n🔤 Embedding service configured for lazy initialization...")
    components_status["embeddings"] = "✅ Configured (lazy)"
    
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
    print(f"🎯 Architecture: Router → ReAct + CoT Agent | Web Scraping Agent\\n")
    
    yield
    
    # Shutdown
    print("\\n\\n👋 Shutting down MIDAS Multi-Agent System...")



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

# Bypass authentication for CORS preflight requests
@app.middleware("http")
async def bypass_options_middleware(request: Request, call_next):
    """Handle OPTIONS requests for CORS preflight"""
    if request.method == "OPTIONS":
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Prometheus metrics
#
# monitoring/prometheus.yml already scrapes this service and prometheus-client
# is already a dependency, but nothing exposed /metrics until now.
# Labels use the *route template* (via _get_request_path) rather than the raw
# URL, so /sessions/{session_id}/messages stays one time series instead of one
# per session id.
# ---------------------------------------------------------------------------
_http_requests = Counter(
    "midas_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
_http_latency = Histogram(
    "midas_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Record request count and latency. Route is only known after call_next."""
    start = time.perf_counter()
    response = await call_next(request)
    path = _get_request_path(request)
    _http_requests.labels(request.method, path, str(response.status_code)).inc()
    _http_latency.labels(request.method, path).observe(time.perf_counter() - start)
    return response


app.mount("/metrics", make_asgi_app())


# Include routers
app.include_router(document_processing_router, prefix="/api/v1", tags=["document-processing"])
app.include_router(reports_router, prefix="/api/v1", tags=["reports"])
app.include_router(image_analysis_router, prefix="/api/v1", tags=["image-analysis"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MIDAS Multi-Agent RAG API",
        "version": "3.0.0",
        "status": "running",
        "architecture": "router_based",
        "agents": ["router", "react_cot_agent", "web_scraping_agent"],
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
        },
        "vector_store": stats if stats else {"status": "not_configured"},
        "agents": {
            "router_agent": "active",
            "react_cot_agent": "active",
            "web_scraping_agent": "active" if tavily_service.is_configured() else "inactive"
        }
    }


@app.get("/healthz")
async def liveness():
    """Simple liveness probe: process is up."""
    return {"status": "ok"}


@app.get("/readyz")
async def readiness(response: Response):
    """
    Readiness probe. Returns 503 when not ready so orchestrators (Kubernetes
    readinessProbe, Docker healthcheck) actually withhold traffic.

    SCOPE: `supabase_ready` reflects whether the client was CONSTRUCTED, not
    whether Supabase is reachable. `initialize()` calls `create_client()`, which
    makes no network request, so this reports 200 whenever credentials are set —
    including during a total Supabase outage. It is a configuration check, not a
    dependency check.

    Making it a real dependency check means issuing a cheap query here (e.g.
    `select id limit 1`) with an explicit short timeout, offloaded via
    `asyncio.to_thread` because the supabase client is synchronous and would
    otherwise block the event loop. That is a deliberate availability tradeoff:
    a Supabase blip would then pull every pod out of rotation.
    """
    ready = True
    details = {}

    # Supabase readiness (vector store initialized)
    details["supabase_ready"] = supabase_vector_store.is_ready()
    ready = ready and details["supabase_ready"]

    # Redis readiness (optional — deliberately excluded from `ready`; the cache
    # layer is inert and the app serves correctly without it)
    try:
        from app.cache import cache_manager
        details["redis_ready"] = cache_manager.health_check()
    except Exception:
        details["redis_ready"] = False

    # Embeddings service note
    details["embeddings_configured"] = True

    if not ready:
        response.status_code = 503

    return {"ready": ready, **details}




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
    - Query without URL → ReAct + CoT Agent (Vector Store + LLM)
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
            lesion_class=request.lesion_class,
            subject_role=request.subject_role
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
        if isinstance(e, NotFoundError):
            logger.error(f"NVIDIA function not found: {e}")
            fallback_response = _build_provider_error_response(
                "The NVIDIA API returned a 404 for a configured function/model reference."
            )
            await _persist_assistant_fallback(session_id, request.user_id, fallback_response)
            return fallback_response
        logger.error(f"Error processing message: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details:", exc_info=True)
        fallback_response = _build_provider_error_response(str(e))
        await _persist_assistant_fallback(session_id, request.user_id, fallback_response)
        return fallback_response


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
                try:
                    supabase.table('documents').update({
                        'status': 'failed',
                        'content': text_content or ''
                    }).eq('id', document_id).execute()
                except Exception as e:
                    logger.error(f"Failed to update status to failed: {e}")

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

        # Index document in B+ tree for efficient chunk retrieval
        logger.info("🌳 Indexing document in B+ tree...")
        from app.indexing.rag_chunk_index import rag_chunk_index

        chunk_metas = rag_chunk_index.index_document(
            tenant_id="default",
            doc_id=document_id,
            text=text_content,
            chunk_size=500,  # Match chunk_size used for embeddings
            overlap=100,  # Overlap for context continuity
            lesion_class=doc.get('lesion_class'),
            source=doc.get('source', 'upload')
        )
        logger.info(f"   Indexed {len(chunk_metas)} chunks in B+ tree")

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
        try:
            update_result = supabase.table('documents').update({
                'status': 'processed'
            }).eq('id', document_id).execute()
            
            logger.info(f"✅ Document {document_id} processed successfully")
            logger.info(f"   Status updated to: processed")
            logger.info(f"   Chunks: {len(chunks)}, Embeddings: {len(embedding_records)}")
        except Exception as status_error:
            logger.error(f"❌ Failed to update status to processed: {status_error}")
            # Don't fail the whole operation if status update fails
            # The embeddings are already created

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
