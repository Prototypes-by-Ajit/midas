"""Pydantic models for API requests and responses."""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum


class RouteType(str, Enum):
    """Routing decision types."""
    ANSWER = "answer"
    CLARIFY = "clarify"
    REFUSE = "refuse"
    WEB_SCRAPING = "web_scraping"


class ChatQuery(BaseModel):
    """Request model for chat queries."""
    query: str = Field(..., min_length=1, max_length=500, description="User's question")
    session_id: Optional[str] = Field(None, description="Session ID for conversation tracking")
    user_id: Optional[str] = Field(None, description="User ID for memory and tracking")


class Citation(BaseModel):
    """Citation for information sources."""
    source: str = Field(..., description="Source document name")
    content: str = Field(..., description="Relevant excerpt from source")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Relevance score")


class ChatResponse(BaseModel):
    """Response model for chat queries."""
    answer: str = Field(..., description="Generated answer")
    citations: List[Citation] = Field(default_factory=list, description="Source citations")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    route: Literal["answer", "clarify", "refuse"] = Field(..., description="Response routing decision")
    session_id: Optional[str] = Field(None, description="Session ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")
    metadata: Optional[dict] = Field(None, description="Optional metadata (e.g., planner info)")


class HealthResponse(BaseModel):
    """Health check response."""
    status: Literal["healthy", "unhealthy"] = Field(..., description="Service status")
    models_loaded: bool = Field(..., description="Whether LLM and embeddings are loaded")
    vector_store_ready: bool = Field(..., description="Whether vector store is initialized")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")


class FeedbackRequest(BaseModel):
    """User feedback on responses."""
    session_id: str = Field(..., description="Session ID")
    message_id: str = Field(..., description="Message ID being rated")
    helpful: bool = Field(..., description="Whether response was helpful")
    comment: Optional[str] = Field(None, max_length=500, description="Optional feedback comment")


class RouterOutput(BaseModel):
    """Output from domain router."""
    in_scope: bool = Field(..., description="Whether query is in scope")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence")
    route: Literal["answer", "clarify", "refuse"] = Field(..., description="Routing decision")
    reason: Optional[str] = Field(None, description="Reason for routing decision")


class Document(BaseModel):
    """Retrieved document."""
    content: str = Field(..., description="Document content")
    metadata: dict = Field(default_factory=dict, description="Document metadata")
    score: float = Field(..., description="Relevance score")


class GraderOutput(BaseModel):
    """Output from evidence grader."""
    sufficient: bool = Field(..., description="Whether evidence is sufficient")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Grading confidence")
    reason: Optional[str] = Field(None, description="Reason for grading decision")
