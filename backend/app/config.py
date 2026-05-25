"""Configuration settings for MIDAS RAG backend."""
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.backend", "../.env.backend"),
        case_sensitive=False,
        extra="ignore",
    )
    
    # ==================== Cloud Database (Supabase) ====================
    supabase_url: Optional[str] = None  # https://xxxxx.supabase.co
    supabase_anon_key: Optional[str] = None  # Public anon key
    supabase_service_key: Optional[str] = None  # Secret service role key (for admin operations)

    @property
    def supabase_url_normalized(self) -> Optional[str]:
        """Ensure Supabase URL has trailing slash for storage operations"""
        if self.supabase_url:
            return self.supabase_url.rstrip("/") + "/"
        return None

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
    enable_session_cache: bool = False
    
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
    
    # ==================== LLM Provider (Nemotron/Ollama) ====================
    llm_provider: str = "nemotron"  # nemotron or ollama

    # NVIDIA Nemotron Configuration (Primary)
    nvidia_api_key: Optional[str] = None
    nvidia_model: str = "nvidia/llama-3.1-nemotron-70b-instruct"
    nvidia_temperature: float = 0.2
    nvidia_max_tokens: int = 1000
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    
    # Tavily AI Search Configuration (Web-grounded RAG)
    tavily_api_key: Optional[str] = None
    
    # ==================== Model Versions ====================
    doc_index_version: str = "1.0.0"
    embedding_model_version: str = "all-MiniLM-L6-v2"
    reranker_version: str = "ms-marco-MiniLM-L-6-v2"
    llm_version: str = "nvidia-nemotron-70b"
    
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

    # ==================== Embedding Provider ====================
    embedding_provider: str = "local"  # local or hosted
    embedding_api_url: Optional[str] = None  # e.g., https://api.openai.com/v1/embeddings
    embedding_api_key: Optional[str] = None
    embedding_api_model: Optional[str] = None
    
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
    api_port: int = 8000
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
    supabase_session_cache_function: str = "conversation-cache"

    @field_validator("debug", "testing", "reload", mode="before")
    @classmethod
    def _parse_bool_aliases(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value

    # ==================== Legacy Groq aliases (compatibility with older modules) ====================
    # These are mirrored from NVIDIA settings during initialization so existing code paths
    # that still read settings.groq_* continue to function.
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.1-8b-instant"
    groq_temperature: float = 0.2
    groq_max_tokens: int = 500

    @model_validator(mode="after")
    def _sync_groq_aliases(self):
        """Mirror NVIDIA configuration into legacy Groq fields for backward compatibility."""
        if self.nvidia_api_key and not self.groq_api_key:
            self.groq_api_key = self.nvidia_api_key
        if self.nvidia_model and self.groq_model == "llama-3.1-8b-instant":
            self.groq_model = self.nvidia_model
        if self.nvidia_temperature and self.groq_temperature == 0.2:
            self.groq_temperature = self.nvidia_temperature
        if self.nvidia_max_tokens and self.groq_max_tokens == 500:
            self.groq_max_tokens = self.nvidia_max_tokens
        return self
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        raw_values = [
            self.cors_origins,
            os.getenv("ALLOWED_ORIGINS", ""),
            os.getenv("FRONTEND_URL", ""),
            os.getenv("RAILWAY_SERVICE_MIDAS_FRONTEND__URL", ""),
            os.getenv("RAILWAY_SERVICE_MIDAS_FRONTEND_URL", ""),
        ]
        origins: List[str] = []
        for raw in raw_values:
            for origin in raw.split(","):
                cleaned = origin.strip().rstrip("/")
                if not cleaned:
                    continue
                if not cleaned.startswith("http://") and not cleaned.startswith("https://"):
                    cleaned = f"https://{cleaned}"
                if cleaned not in origins:
                    origins.append(cleaned)
        return origins
    
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
