"""Configuration settings for MIDAS RAG backend."""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ==================== Cloud Database (Supabase) ====================
    supabase_url: Optional[str] = None  # https://xxxxx.supabase.co
    supabase_anon_key: Optional[str] = None  # Public anon key
    supabase_service_key: Optional[str] = None  # Secret service role key (for admin operations)

    # Supabase Storage Configuration
    supabase_storage_bucket: str = "Multiagent_Skincancer_RAG"
    use_supabase_storage: bool = True  # Toggle between local files and Supabase Storage
    
    # Direct PostgreSQL connection (from Supabase settings -> Database -> Connection string)
    database_url: str = "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    enable_pgvector: bool = True  # Use pgvector for embeddings
    
    # ==================== Redis Cache ====================
    redis_url: str = "redis://localhost:6379/0"
    redis_password: Optional[str] = None
    redis_max_connections: int = 50
    
    # Cloud Redis (Upstash) - alternative to local Redis
    upstash_redis_url: Optional[str] = None  # redis://:password@region.upstash.io:port
    use_upstash: bool = False  # Toggle between local and cloud Redis
    
    # Cache TTL (seconds)
    redis_cache_ttl_embedding: int = 604800  # 7 days
    redis_cache_ttl_retrieval: int = 21600   # 6 hours
    redis_cache_ttl_rerank: int = 21600      # 6 hours
    redis_cache_ttl_generation: int = 86400  # 24 hours
    redis_cache_ttl_tool: int = 43200        # 12 hours
    redis_cache_ttl_session: int = 3600      # 1 hour
    
    # ==================== LLM Provider (Groq/Ollama) ====================
    llm_provider: str = "groq"  # groq or ollama
    
    # Groq Configuration (Primary - Ultra-fast inference)
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.1-8b-instant"  # or mixtral-8x7b-32768
    groq_temperature: float = 0.2
    groq_max_tokens: int = 1000
    
    # Tavily AI Search Configuration (Web-grounded RAG)
    tavily_api_key: Optional[str] = None
    
    # ==================== Model Versions ====================
    doc_index_version: str = "1.0.0"
    embedding_model_version: str = "all-MiniLM-L6-v2"
    reranker_version: str = "ms-marco-MiniLM-L-6-v2"
    llm_version: str = "groq-llama-3.1-8b"
    
    # ==================== Ollama Configuration ====================
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    ollama_temperature: float = 0.2
    ollama_max_tokens: int = 500
    ollama_timeout: int = 60
    
    # ==================== Vector Store ====================
    vector_db_path: str = "./app/data/index"
    knowledge_base_path: str = "./app/data/knowledge_base"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    
    # ==================== Retrieval Configuration ====================
    top_k_documents: int = 10
    top_k_after_rerank: int = 5
    min_confidence_threshold: float = 0.3
    hybrid_search_alpha: float = 0.5  # 0=pure keyword, 1=pure vector
    
    # ==================== Memory Configuration ====================
    session_memory_max_turns: int = 10
    session_memory_token_budget: int = 4000
    user_memory_max_items: int = 50
    memory_retention_days: int = 90
    
    # ==================== Lesion Classes ====================
    lesion_classes: str = "MEL,NV,BCC,AKIEC,BKL,DF,VASC"

    # ==================== CNN Model Configuration ====================
    cnn_model_path: str = "./models/midas_v1_final_best.pth"
    cnn_model_load_on_startup: bool = False  # True = load on startup, False = lazy load
    cnn_image_size: int = 224
    cnn_num_classes: int = 7

    # ==================== Safety & Guardrails ====================
    max_query_length: int = 500
    enable_strict_domain_enforcement: bool = True
    enable_grounding_verification: bool = True
    min_grounding_score: float = 0.7
    enable_medical_disclaimer: bool = True
    
    # ==================== MCP Configuration ====================
    mcp_enabled: bool = True
    mcp_audit_enabled: bool = True
    mcp_policy_enforcement: str = "strict"  # strict, moderate, permissive
    
    # ==================== API Configuration ====================
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    api_rate_limit_per_minute: int = 60
    backend_api_key: Optional[str] = None
    
    # ==================== Observability ====================
    enable_metrics: bool = True
    enable_tracing: bool = True
    enable_rag_traces: bool = True
    prometheus_port: int = 9090
    log_level: str = "INFO"
    log_format: str = "json"  # json or text
    
    # ==================== Feature Flags ====================
    use_clara_architecture: bool = True  # ✅ ACTIVATE FULL AGENT MODE
    enable_hybrid_search: bool = True
    enable_reranking: bool = True
    enable_caching: bool = True
    enable_user_memory: bool = True
    enable_session_memory: bool = True

    # ==================== RAG Optimization Layers ====================
    # Layer 1: Hybrid Retrieval (BM25 + pgvector + Reranking)
    enable_hybrid_retrieval: bool = True   # Toggle Layer 1 ON/OFF ✅ ENABLED
    hybrid_retrieval_top_k: int = 10       # Candidates for reranking
    hybrid_retrieval_rerank_top_n: int = 5 # Final results after reranking
    hybrid_retrieval_rrf_k: int = 60       # Reciprocal Rank Fusion parameter

    # Layer 2: Planner Agent (ReAct/CoT)
    enable_planner: bool = True            # Toggle Layer 2 ON/OFF ✅ ENABLED
    planner_max_steps: int = 5
    enable_fallback_strategy: bool = True  # ✅ ENABLED

    # Layer 3: Evidence Grading & Citation Verification
    enable_evidence_grading: bool = True   # Toggle Layer 3 ON/OFF ✅ ENABLED
    enable_citation_verification: bool = True  # ✅ ENABLED
    min_evidence_score: float = 0.3

    # Layer 4: Conversation Memory
    enable_conversation_memory: bool = True  # Toggle Layer 4 ON/OFF ✅ ENABLED
    memory_k: int = 3                      # Number of past interactions to retrieve
    memory_ttl_days: int = 30              # Memory retention period

    # Layer 5: Enhanced Guardrails
    enable_enhanced_guardrails: bool = True  # Toggle Layer 5 ON/OFF ✅ ENABLED
    enable_input_guardrails: bool = True   # ✅ ENABLED
    enable_output_guardrails: bool = True  # ✅ ENABLED
    enable_pii_detection: bool = True      # ✅ ENABLED
    
    # ==================== Security ====================
    secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440  # 24 hours
    
    # ==================== Development ====================
    debug: bool = False
    testing: bool = False
    reload: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def lesion_classes_list(self) -> List[str]:
        """Parse lesion classes from comma-separated string."""
        return [cls.strip() for cls in self.lesion_classes.split(",")]


# Global settings instance
settings = Settings()

# Medical disclaimer template
MEDICAL_DISCLAIMER = (
    "\n\n*This is educational information only. "
    "Please consult a qualified dermatologist for proper diagnosis and treatment.*"
)

# Scope definition
IN_SCOPE_TOPICS = [
    "melanoma",
    "basal cell carcinoma",
    "squamous cell carcinoma",
    "skin cancer",
    "mole",
    "lesion",
    "dermoscopy",
    "biopsy",
    "abcde rule",
    "skin examination",
    "treatment",
    "prevention",
    "risk factors",
    "sun exposure",
    "uv radiation",
]
