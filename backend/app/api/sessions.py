"""Session management API routes with Supabase integration."""
import logging
from typing import List, Optional
from datetime import datetime
import json
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi import Request
from pydantic import BaseModel, Field

from app.services.supabase_sessions import supabase_session_service
from app.services.chat_persistence import chat_persistence

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ============================================
# Request/Response Models
# ============================================

class CreateSessionRequest(BaseModel):
    """Request model for creating a session."""
    user_id: str = Field(..., description="User ID from Clerk/Auth")
    title: Optional[str] = Field(None, description="Optional session title")
    context: Optional[dict] = Field(default_factory=dict, description="Initial context")


class SessionResponse(BaseModel):
    """Response model for session details."""
    id: str
    user_id: str
    title: Optional[str] = None
    status: str = "active"
    created_at: str
    updated_at: str
    last_message_at: Optional[str] = None
    message_count: int = 0
    context: dict = Field(default_factory=dict)


class MessageResponse(BaseModel):
    """Response model for messages."""
    id: str
    session_id: str
    role: str
    content: str
    created_at: str
    metadata: dict = Field(default_factory=dict)


class SessionListResponse(BaseModel):
    """Response model for listing sessions."""
    sessions: List[SessionResponse]
    total: int
    limit: int
    offset: int


class MessageListResponse(BaseModel):
    """Response model for listing messages."""
    messages: List[MessageResponse]
    total: int
    limit: int
    offset: int


# ============================================
# Session CRUD Operations
# ============================================

@router.post("", response_model=SessionResponse)
async def create_session(
    request: CreateSessionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create a new chat session in Supabase.
    
    Uses the conversations table with proper RLS policies.
    """
    try:
        session = await supabase_session_service.create_session(
            user_id=request.user_id,
            title=request.title,
            context=request.context
        )
        
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create session")
        
        return SessionResponse(**session)
    
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    user_id: str = Query(..., description="User ID to filter sessions"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: Optional[str] = Header(None)
):
    """
    List all sessions for a user (paginated).
    
    Returns sessions ordered by last_message_at descending.
    """
    try:
        result = await supabase_session_service.list_sessions(
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        
        return SessionListResponse(
            sessions=[SessionResponse(**s) for s in result["sessions"]],
            total=result["total"],
            limit=limit,
            offset=offset
        )
    
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Get session details by ID.
    
    Returns full session metadata including context and message count.
    """
    try:
        session = await supabase_session_service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return SessionResponse(**session)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    title: Optional[str] = None,
    status: Optional[str] = None,
    context: Optional[dict] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Update session metadata.
    
    Allows updating title, status, and context.
    """
    try:
        updates = {}
        if title is not None:
            updates["title"] = title
        if status is not None:
            updates["status"] = status
        if context is not None:
            updates["context"] = context
        
        session = await supabase_session_service.update_session(session_id, updates)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return SessionResponse(**session)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete a session and all its messages (cascade).
    
    Also clears session_cache and session_summaries.
    """
    try:
        success = await supabase_session_service.delete_session(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"status": "success", "message": f"Session {session_id} deleted"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Message Operations
# ============================================

@router.get("/{session_id}/messages", response_model=MessageListResponse)
async def get_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    authorization: Optional[str] = Header(None)
):
    """
    Get messages for a session (paginated).
    
    Returns messages ordered by created_at ascending (oldest first).
    """
    try:
        messages = await chat_persistence.get_session_messages(
            session_id=session_id,
            limit=limit,
            offset=offset
        )
        
        total = await chat_persistence.get_session_count(session_id)
        
        return MessageListResponse(
            messages=[MessageResponse(**m) for m in messages],
            total=total,
            limit=limit,
            offset=offset
        )
    
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/messages", response_model=MessageResponse)
async def create_message(
    session_id: str,
    request: Request,
    role: str = "user",
    content: str = "",
    user_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Create a new message in a session.
    
    Updates session.last_message_at and message_count automatically.
    """
    try:
        body = {}
        try:
            body = await request.json()
        except json.JSONDecodeError:
            pass
        except Exception:
            # Keep backward compatibility when no JSON body is supplied
            body = {}

        role = body.get("role", role)
        user_id = body.get("user_id", user_id)
        metadata = body.get("metadata", metadata)
        content = body.get("content", body.get("query", content))

        # Validate role
        if role not in ["user", "assistant", "system"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        if not content or not str(content).strip():
            raise HTTPException(status_code=400, detail="Content is required")
        
        # Save message
        message_id = await chat_persistence.save_message(
            session_id=session_id,
            role=role,
            content=content,
            user_id=user_id,
            metadata=metadata or {}
        )
        
        if not message_id:
            raise HTTPException(status_code=500, detail="Failed to save message")
        
        # Update session activity
        await supabase_session_service.update_session_activity(session_id)
        
        # Return the created message
        messages = await chat_persistence.get_session_messages(session_id, limit=1, offset=0)
        if messages:
            return MessageResponse(**messages[0])
        
        raise HTTPException(status_code=500, detail="Failed to retrieve created message")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Session Cache Integration
# ============================================

@router.get("/{session_id}/cache")
async def get_session_cache(
    session_id: str,
    limit: int = Query(8, ge=1, le=20),
    include_summary: bool = Query(False),
    authorization: Optional[str] = Header(None)
):
    """
    Get cached conversation context via Supabase edge function.
    
    Returns recent messages + optional summary for efficient context loading.
    """
    try:
        cache_data = await supabase_session_service.get_session_cache(
            session_id=session_id,
            limit=limit,
            include_summary=include_summary,
            auth_token=authorization
        )
        
        return cache_data
    
    except Exception as e:
        logger.error(f"Error getting session cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/cache/refresh")
async def refresh_session_cache(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Force refresh session cache.
    
    Useful after adding many messages or updating summaries.
    """
    try:
        result = await supabase_session_service.refresh_session_cache(
            session_id=session_id,
            auth_token=authorization
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error refreshing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}/cache")
async def clear_session_cache(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Clear session cache.
    
    Next request will rebuild from messages table.
    """
    try:
        result = await supabase_session_service.clear_session_cache(
            session_id=session_id,
            auth_token=authorization
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))
