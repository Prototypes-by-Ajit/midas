"""Configuration settings for MIDAS RAG backend."""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Ollama Configuration
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    
    # Vector Store Configuration
    vector_db_path: str = "./app/data/index"
    knowledge_base_path: str = "./app/data/knowledge_base"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # LLM Configuration
    max_tokens: int = 500
    temperature: float = 0.2
    top_k_documents: int = 5
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    
    # Guardrails
    max_query_length: int = 500
    min_confidence_threshold: float = 0.3
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


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
