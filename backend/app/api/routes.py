"""API routes for RAG chat system."""
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ChatQuery,
    ChatResponse,
    HealthResponse,
    FeedbackRequest
)
from app.agents.graph import orchestrator as old_orchestrator
from app.clara import clara_orchestrator
from app.utils.guardrails import guardrails
from app.services.llm_service import llm_service
from app.services.supabase_vector_store import supabase_vector_store
from app.services.embeddings import embedding_service
from app.services.chat_persistence import chat_persistence
from app.cache import cache_manager
from app.db import db_manager
from app.observability import rag_trace_logger
from app.config import settings
from app.agents.follow_up_resolver import follow_up_resolver
from app.agents.query_guardrails_agent import query_guardrails_agent
from app.agents.dynamic_guardrails_classifier import dynamic_classifier

# Import document processing router
from app.api.document_processing import router as document_processing_router
# Import reports router
from app.api.reports import router as reports_router
# Import sessions router
from app.api.sessions import router as sessions_router

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

# Include document processing routes
router.include_router(document_processing_router, tags=["document-processing"])
# Include reports routes
router.include_router(reports_router, tags=["reports"])
# Include sessions routes
router.include_router(sessions_router, tags=["sessions"])


# ============================================
# Session Management (RESTful Resources)
# ============================================

@router.post("/sessions")
async def create_session(user_id: str = None):
    """
    Create a new chat session.
    
    Args:
        user_id: Optional user identifier
        
    Returns:
        Session resource with ID
    """
    import uuid
    from datetime import datetime
    
    session_id = str(uuid.uuid4())
    
    # In production, store in database
    return {
        "session_id": session_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active"
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """
    Get session details and history.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session resource with message history
    """
    # In production, fetch from database
    # For now, return structure
    return {
        "session_id": session_id,
        "messages": [],
        "created_at": None,
        "last_activity": None,
        "status": "active"
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and its history.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Success message
    """
    # In production, delete from database and cache
    return {
        "status": "success",
        "message": f"Session {session_id} deleted"
    }


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, limit: int = 50, offset: int = 0):
    """
    Get messages for a session (paginated).

    Args:
        session_id: Session identifier
        limit: Number of messages to return
        offset: Pagination offset

    Returns:
        List of message resources
    """
    try:
        # Fetch messages from database
        messages = await chat_persistence.get_session_messages(session_id, limit, offset)
        total = await chat_persistence.get_session_count(session_id)

        return {
            "session_id": session_id,
            "messages": messages,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        print(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@router.post("/sessions/{session_id}/messages", response_model=ChatResponse)
async def create_message(session_id: str, request: ChatQuery):
    """
    Process a chat query through the agentic RAG system.
    Uses CLARA if enabled, otherwise falls back to old orchestrator.

    Args:
        request: ChatQuery with user's question

    Returns:
        ChatResponse with answer and citations
    """
    # Validate input
    is_valid, error_msg = guardrails.validate_input(request.query)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Sanitize input
    sanitized_query = guardrails.sanitize_query(request.query)
    
    # ===== STAGE 0: POLICY-BASED GUARDRAILS (DYNAMIC LLM-BASED) =====
    # Retrieve conversation history
    conversation_history = await chat_persistence.get_session_messages(
        session_id=session_id,
        limit=5
    )
    
    # Use DYNAMIC LLM-based classifier (thinks instead of keyword matching)
    llm_classification = await dynamic_classifier.classify_domain(
        query=sanitized_query,
        conversation_history=conversation_history
    )
    
    # Map to guardrails decision format
    domain = llm_classification["domain"]
    
    # Build guardrails decision from LLM classification
    guardrails_decision = {
        "domain": domain,
        "intent": "FOLLOWUP" if domain == "FOLLOWUP_REFERENTIAL" else "ASK_INFO",
        "referential": domain == "FOLLOWUP_REFERENTIAL",
        "response_policy": "MEDICAL_STRICT" if domain == "IN_SCOPE_MEDICAL_DERM" else (
            "REFERENTIAL_FOLLOWUP" if domain == "FOLLOWUP_REFERENTIAL" else "OUT_OF_SCOPE"
        ),
        "next_action": "STOP" if domain == "OUT_OF_SCOPE" else (
            "RESOLVE_FOLLOWUP" if domain == "FOLLOWUP_REFERENTIAL" else "RETRIEVE"
        ),
        "confidence_threshold": 0.75 if domain == "IN_SCOPE_MEDICAL_DERM" else 0.0,
        "apply_medical_disclaimer": domain == "IN_SCOPE_MEDICAL_DERM",
        "llm_reasoning": llm_classification.get("reasoning", ""),
        "classification_confidence": llm_classification.get("confidence", 0.0),
    }
    
    logger.info(
        f"🛡️ Guardrails (DYNAMIC): domain={guardrails_decision['domain']}, "
        f"policy={guardrails_decision['response_policy']}, "
        f"action={guardrails_decision['next_action']}, "
        f"reasoning={guardrails_decision.get('llm_reasoning', 'N/A')}"
    )
    
    # Handle OUT_OF_SCOPE immediately (STRICT: return template only)
    if guardrails_decision["next_action"] == "STOP":
        from app.models.schemas import Citation, RouteType
        from datetime import datetime
        
        # MANDATORY: exact OUT_OF_SCOPE template, no medical language
        out_of_scope_answer = dynamic_classifier.get_out_of_scope_message()
        
        # Save messages
        await chat_persistence.save_message(
            session_id=session_id,
            role="user",
            content=sanitized_query,
            user_id=request.user_id
        )
        await chat_persistence.save_message(
            session_id=session_id,
            role="assistant",
            content=out_of_scope_answer,
            user_id=request.user_id,
            citations=[],
            confidence=0.0,
            route="out_of_scope"
        )
        
        return ChatResponse(
            answer=out_of_scope_answer,
            citations=[],
            confidence=0.0,
            route=RouteType.REFUSE,
            session_id=session_id,
            timestamp=datetime.utcnow(),
            metadata={"guardrails_decision": guardrails_decision}
        )
    
    # ===== STAGE 1: FOLLOW-UP RESOLUTION (Rule G4) =====
    # Only if guardrails says to resolve follow-up
    resolved_query = sanitized_query
    resolution = {}
    
    if guardrails_decision["next_action"] == "RESOLVE_FOLLOWUP":
        resolution = follow_up_resolver.resolve(sanitized_query, conversation_history)
        resolved_query = resolution.get("rewritten_query", sanitized_query)
        is_ambiguous = resolution.get("ambiguous", False)
        
        logger.info(f"🔄 Follow-up resolved: '{sanitized_query}' → '{resolved_query}'")
        
        # If ambiguous referential follow-up, request clarification immediately
        if is_ambiguous:
            from app.models.schemas import Citation, RouteType
            from datetime import datetime
            options = [
                "warning signs",
                "treatment options",
                "diagnosis/biopsy",
            ]
            clarify_answer = (
                f"When you say '{sanitized_query}', do you mean one of these about the prior topic? "
                f"(A) {options[0]}, (B) {options[1]}, or (C) {options[2]}? "
                f"Please pick one so I can provide a grounded answer with citations.\n\n"
                "*This is educational information only. Please consult a qualified dermatologist for proper diagnosis and treatment.*"
            )
            # Save user message
            await chat_persistence.save_message(
                session_id=session_id,
                role="user",
                content=sanitized_query,
                user_id=request.user_id
            )
            # Save clarification response
            await chat_persistence.save_message(
                session_id=session_id,
                role="assistant",
                content=clarify_answer,
                user_id=request.user_id,
                citations=[],
                confidence=0.5,
                route="clarify"
            )
            return ChatResponse(
                answer=clarify_answer,
                citations=[],
                confidence=0.5,
                route=RouteType.CLARIFY,
                session_id=session_id,
                timestamp=datetime.utcnow(),
                metadata={"guardrails_decision": guardrails_decision}
            )

    try:
        # Save user message to database (use ORIGINAL query for audit trail)
        await chat_persistence.save_message(
            session_id=session_id,
            role="user",
            content=sanitized_query,
            user_id=request.user_id
        )

        # Choose orchestrator based on feature flag
        # Use resolved_query (rewritten if referential, original otherwise)
        if settings.use_clara_architecture:
            response = await clara_orchestrator.process_query(
                query=resolved_query,
                user_id=request.user_id,
                session_id=session_id
            )
        else:
            response = await old_orchestrator.process_query(
                query=resolved_query,
                session_id=session_id
            )

        # Validate output
        is_valid, warning = guardrails.validate_output(response.answer)
        if not is_valid:
            print(f"⚠️  Output validation warning: {warning}")
            # Log warning but don't block response

        # Inject guardrails decision into response metadata
        if not hasattr(response, 'metadata') or response.metadata is None:
            response.metadata = {}
        response.metadata["guardrails_decision"] = guardrails_decision
        
        # Save assistant response to database
        await chat_persistence.save_message(
            session_id=session_id,
            role="assistant",
            content=response.answer,
            user_id=request.user_id,
            citations=[c.dict() for c in response.citations] if response.citations else [],
            confidence=response.confidence,
            route=response.route
        )

        return response

    except Exception as e:
        print(f"Error processing query: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your query. Please try again."
        )


# ============================================
# System Health & Status
# ============================================

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Check the health of the entire RAG system.
    
    Returns:
        HealthResponse with system status
    """
    try:
        # Check LLM availability
        llm_ok = await llm_service.health_check()
        
        # Check vector store
        vector_ok = supabase_vector_store.is_ready()
        
        # Check embedding model (lazy load)
        try:
            embedding_service.load_model()
            embedding_ok = True
        except:
            embedding_ok = False
        
        # Check cache
        cache_ok = cache_manager.health_check() if settings.enable_caching else True
        
        # Check database
        db_ok = db_manager.health_check() if hasattr(db_manager, 'engine') and db_manager.engine else True
        
        all_healthy = llm_ok and vector_ok and embedding_ok and cache_ok and db_ok
        
        return HealthResponse(
            status="healthy" if all_healthy else "unhealthy",
            models_loaded=llm_ok and embedding_ok,
            vector_store_ready=vector_ok
        )
    except Exception as e:
        print(f"Health check error: {e}")
        return HealthResponse(
            status="unhealthy",
            models_loaded=False,
            vector_store_ready=False
        )


@router.post("/sessions/{session_id}/messages/{message_id}/feedback")
async def create_feedback(session_id: str, message_id: str, request: FeedbackRequest):
    """
    Submit feedback on a specific chat message.
    
    Args:
        session_id: Session identifier
        message_id: Message identifier
        request: FeedbackRequest with rating
        
    Returns:
        Success message
    """
    # In a production system, this would store feedback in a database
    print(f"Feedback received: session={session_id}, "
          f"message={message_id}, helpful={request.helpful}")
    
    if request.comment:
        print(f"  Comment: {request.comment}")
    
    return {"status": "success", "message": "Feedback received"}


# ============================================
# Metrics & Monitoring
# ============================================

@router.get("/metrics/cache")
async def get_cache_metrics():
    """
    Get cache performance metrics.
    
    Returns:
        Cache hit rates and statistics
    """
    if not settings.enable_caching:
        return {"enabled": False, "message": "Caching is disabled"}
    
    try:
        metrics = cache_manager.get_metrics()
        redis_info = cache_manager.get_info()
        
        return {
            "enabled": True,
            "metrics": metrics,
            "redis_info": redis_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching metrics: {str(e)}")


# ============================================
# Admin & Cache Management
# ============================================

@router.delete("/cache")
async def delete_cache(version_key: str = None):
    """
    Invalidate cache for a specific version.
    Admin endpoint for cache management.
    
    Args:
        version_key: Version identifier to invalidate
        
    Returns:
        Number of keys deleted
    """
    if not settings.enable_caching:
        return {"enabled": False, "message": "Caching is disabled"}
    
    try:
        if version_key:
            deleted = cache_manager.invalidate_version(version_key)
            return {
                "status": "success",
                "version_key": version_key,
                "keys_deleted": deleted
            }
        else:
            # Clear all caches if no version specified
            deleted = cache_manager.clear_all()
            return {
                "status": "success",
                "message": "All caches cleared",
                "keys_deleted": deleted
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error invalidating cache: {str(e)}")


@router.get("/metrics/rag")
async def get_rag_metrics():
    """
    Get RAG system metrics including traces and aggregates.
    
    Returns:
        Aggregate RAG metrics and summary statistics
    """
    try:
        metrics = rag_trace_logger.get_aggregate_metrics()
        
        return {
            "total_queries": metrics["total_queries"],
            "avg_latency_ms": metrics["avg_total_latency_ms"],
            "cache_hit_rate": metrics["avg_cache_hit_rate"],
            "avg_grounding_score": metrics["avg_grounding_score"],
            "avg_num_citations": metrics["avg_num_citations"],
            "latency_breakdown": {
                "retrieval_ms": metrics["avg_retrieval_latency_ms"],
                "generation_ms": metrics["avg_generation_latency_ms"]
            },
            "traces_stored": metrics["total_queries"]  # Since we keep last 1000
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching RAG metrics: {str(e)}")


@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str):
    """
    Get detailed trace information for a specific query.
    
    Args:
        trace_id: Unique trace identifier
        
    Returns:
        Complete trace data including all metrics
    """
    try:
        trace = rag_trace_logger.get_trace(trace_id)
        
        if not trace:
            raise HTTPException(status_code=404, detail=f"Trace {trace_id} not found")
        
        return trace
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching trace: {str(e)}")
