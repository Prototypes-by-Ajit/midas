"""SQLAlchemy database models for MIDAS Enhanced RAG."""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    JSON, ForeignKey, Enum, ARRAY, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid
import enum


Base = declarative_base()


class UserType(str, enum.Enum):
    """User role types."""
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class RouteType(str, enum.Enum):
    """RAG routing decisions."""
    ANSWER = "answer"
    CLARIFY = "clarify"
    REFUSE = "refuse"


class LesionClass(str, enum.Enum):
    """7 skin lesion classes."""
    MEL = "MEL"  # Melanoma
    NV = "NV"    # Melanocytic Nevus
    BCC = "BCC"  # Basal Cell Carcinoma
    AKIEC = "AKIEC"  # Actinic Keratosis
    BKL = "BKL"  # Benign Keratosis
    DF = "DF"    # Dermatofibroma
    VASC = "VASC"  # Vascular Lesions


class User(Base):
    """User account table."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(String(255), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    full_name = Column(String(255))
    avatar_url = Column(Text)
    user_type = Column(Enum(UserType), default=UserType.PATIENT, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    imaging_runs = relationship("ImagingRun", back_populates="user", cascade="all, delete-orphan")
    user_memory_items = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    """Chat session table."""
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    title = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True))
    message_count = Column(Integer, default=0)
    context = Column(JSONB, default={})  # Current context (lesion class, prediction, etc.)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")


class Message(Base):
    """Chat message table."""
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    route = Column(Enum(RouteType))
    confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    session = relationship("Session", back_populates="messages")
    rag_trace = relationship("RAGTrace", back_populates="message", uselist=False, cascade="all, delete-orphan")


class ImagingRun(Base):
    """CNN imaging prediction runs."""
    __tablename__ = "imaging_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(Text, nullable=False)
    image_hash = Column(String(64), index=True)
    
    # Prediction results
    predicted_class = Column(Enum(LesionClass), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    all_predictions = Column(JSONB, nullable=False)  # All class probabilities
    
    # Model info
    model_version = Column(String(50), nullable=False)
    model_architecture = Column(String(50))
    
    # Grad-CAM
    gradcam_url = Column(Text)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    user = relationship("User", back_populates="imaging_runs")


class Document(Base):
    """Knowledge base documents."""
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    source = Column(String(255), nullable=False, index=True)
    document_type = Column(String(50), index=True)  # 'guideline', 'research', 'curated'
    content = Column(Text, nullable=False)
    
    # Metadata
    lesion_classes = Column(ARRAY(String), index=True)  # Applicable lesion classes
    author = Column(String(255))
    publication_date = Column(DateTime(timezone=True))
    url = Column(Text)
    
    # Versioning
    doc_version = Column(String(50), default="1.0.0")
    index_version = Column(String(50), nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    """Document chunks for retrieval."""
    __tablename__ = "chunks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    
    # Embedding info
    embedding_model = Column(String(100), nullable=False)
    embedding_dimension = Column(Integer)
    
    # Metadata for filtering
    lesion_classes = Column(ARRAY(String), index=True)
    section_title = Column(String(500))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    __table_args__ = (
        Index('idx_chunks_document_index', 'document_id', 'chunk_index'),
    )


class RAGTrace(Base):
    """Complete audit trail for RAG queries."""
    __tablename__ = "rag_traces"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Query info
    query = Column(Text, nullable=False)
    route = Column(Enum(RouteType), nullable=False)
    
    # Retrieval
    retrieved_chunk_ids = Column(ARRAY(String))
    retrieval_scores = Column(ARRAY(Float))
    retrieval_method = Column(String(50))  # 'vector', 'hybrid', 'keyword'
    
    # Reranking
    reranked_chunk_ids = Column(ARRAY(String))
    rerank_scores = Column(ARRAY(Float))
    reranker_used = Column(Boolean, default=False)
    
    # Context relevancy metrics
    context_relevancy_mean = Column(Float)
    context_relevancy_top1 = Column(Float)
    context_relevancy_min = Column(Float)
    source_diversity = Column(Integer)
    
    # Grounding
    grounding_passed = Column(Boolean)
    grounding_score = Column(Float)
    grounding_reason = Column(Text)
    hallucination_risk = Column(Boolean, default=False)
    
    # Citations
    citation_count = Column(Integer, default=0)
    citations = Column(JSONB, default=[])
    
    # Cache hits
    embedding_cache_hit = Column(Boolean, default=False)
    retrieval_cache_hit = Column(Boolean, default=False)
    rerank_cache_hit = Column(Boolean, default=False)
    generation_cache_hit = Column(Boolean, default=False)
    
    # Latency breakdown (milliseconds)
    latency_total_ms = Column(Integer)
    latency_retrieval_ms = Column(Integer)
    latency_rerank_ms = Column(Integer)
    latency_grounding_ms = Column(Integer)
    latency_generation_ms = Column(Integer)
    
    # Model versions
    doc_index_version = Column(String(50))
    embedding_model_version = Column(String(50))
    reranker_version = Column(String(50))
    llm_version = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json = Column("metadata", JSONB, default={})
    
    # Relationships
    message = relationship("Message", back_populates="rag_trace")


class UserMemory(Base):
    """Long-term user memory (domain-safe)."""
    __tablename__ = "user_memory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    memory_type = Column(String(50), nullable=False, index=True)  # 'preference', 'educational_context', 'image_reference'
    key = Column(String(255), nullable=False)
    value = Column(JSONB, nullable=False)
    
    # Safety
    domain_verified = Column(Boolean, default=False)
    privacy_filtered = Column(Boolean, default=False)
    
    # Versioning
    policy_version = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    accessed_at = Column(DateTime(timezone=True))
    access_count = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="user_memory_items")
    
    __table_args__ = (
        Index('idx_user_memory_user_type', 'user_id', 'memory_type'),
    )


class CacheMetadata(Base):
    """Cache versioning metadata."""
    __tablename__ = "cache_metadata"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Version tracking
    doc_index_version = Column(String(50), nullable=False, unique=True, index=True)
    embedding_model_version = Column(String(50), nullable=False)
    reranker_version = Column(String(50))
    llm_version = Column(String(50))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metrics
    total_documents = Column(Integer)
    total_chunks = Column(Integer)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    activated_at = Column(DateTime(timezone=True))
    metadata_json = Column("metadata", JSONB, default={})


# Create all indexes
def create_indexes():
    """Additional indexes for performance."""
    pass  # Additional composite indexes can be added here if needed
