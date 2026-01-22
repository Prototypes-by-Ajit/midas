"""API routes for RAG chat system."""
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ChatQuery,
    ChatResponse,
    HealthResponse,
    FeedbackRequest
)
from app.agents.graph import orchestrator
from app.utils.guardrails import guardrails
from app.services.llm_service import llm_service
from app.services.vector_store import vector_store
from app.services.embeddings import embedding_service

router = APIRouter(prefix="/api/v1")


@router.post("/chat/query", response_model=ChatResponse)
async def chat_query(request: ChatQuery):
    """
    Process a chat query through the agentic RAG system.
    
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
    
    try:
        # Process through orchestrator
        response = await orchestrator.process_query(
            query=sanitized_query,
            session_id=request.session_id
        )
        
        # Validate output
        is_valid, warning = guardrails.validate_output(response.answer)
        if not is_valid:
            print(f"⚠️  Output validation warning: {warning}")
            # Log warning but don't block response
        
        return response
        
    except Exception as e:
        print(f"Error processing query: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your query. Please try again."
        )


@router.get("/chat/health", response_model=HealthResponse)
async def health_check():
    """
    Check the health of the RAG system.
    
    Returns:
        HealthResponse with system status
    """
    try:
        # Check LLM availability
        llm_ok = await llm_service.health_check()
        
        # Check vector store
        vector_ok = vector_store.is_ready()
        
        # Check embedding model (lazy load)
        try:
            embedding_service.load_model()
            embedding_ok = True
        except:
            embedding_ok = False
        
        all_healthy = llm_ok and vector_ok and embedding_ok
        
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


@router.post("/chat/feedback")
async def submit_feedback(request: FeedbackRequest):
    """
    Submit feedback on a chat response.
    
    Args:
        request: FeedbackRequest with rating
        
    Returns:
        Success message
    """
    # In a production system, this would store feedback in a database
    print(f"Feedback received: session={request.session_id}, "
          f"message={request.message_id}, helpful={request.helpful}")
    
    if request.comment:
        print(f"  Comment: {request.comment}")
    
    return {"status": "success", "message": "Feedback received"}
