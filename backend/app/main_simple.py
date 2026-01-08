"""FastAPI application for MIDAS Agentic RAG backend - Simplified Startup."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Simple configuration
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app."""
    # Startup
    print("🚀 Starting MIDAS RAG Backend (Simple Mode)...")
    print("   ✅ API server ready")
    print("   📝 Note: Full services (DB, Cache, Vector Store) not initialized")
    print("   💡 This is for testing the API structure")
    
    yield
    
    # Shutdown
    print("\n👋 Shutting down MIDAS RAG Backend...")


# Create FastAPI app
app = FastAPI(
    title="MIDAS Agentic RAG API",
    description="Medical AI Assistant for skin cancer education (Simple Mode)",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MIDAS Agentic RAG API",
        "version": "1.0.0",
        "mode": "simple",
        "status": "running",
        "docs": "/docs",
        "note": "Full services not initialized. API structure only."
    }


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "mode": "simple",
        "models_loaded": False,
        "vector_store_ready": False,
        "message": "Simple mode - API structure only"
    }


@app.get("/api/v1/sessions")
async def list_sessions():
    """Mock sessions endpoint."""
    return {
        "sessions": [],
        "total": 0,
        "message": "Simple mode - mock response"
    }


@app.post("/api/v1/sessions")
async def create_session():
    """Mock create session endpoint."""
    import uuid
    from datetime import datetime
    
    return {
        "session_id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat(),
        "status": "active",
        "mode": "simple"
    }


@app.post("/api/v1/sessions/{session_id}/messages")
async def create_message(session_id: str, request: dict):
    """Message creation endpoint with Groq AI support."""
    import os
    from groq import Groq
    
    query = request.get("query", "")
    
    # Check if Groq is configured
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    if groq_api_key and groq_api_key.startswith("gsk_"):
        try:
            # Initialize Groq client
            client = Groq(api_key=groq_api_key)
            model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            
            # Medical context prompt for skin cancer
            system_prompt = (
                "You are MIDAS AI, a medical AI assistant specialized in dermatology and skin cancer. "
                "Focus on melanoma, basal cell carcinoma, squamous cell carcinoma, and skin lesion analysis. "
                "Provide educational, evidence-based responses. Always remind users to consult healthcare professionals. "
                "If asked about topics outside dermatology, politely redirect to skin health topics."
            )
            
            # Call Groq API
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                model=model,
                temperature=float(os.getenv("GROQ_TEMPERATURE", "0.2")),
                max_tokens=int(os.getenv("GROQ_MAX_TOKENS", "500"))
            )
            
            answer = chat_completion.choices[0].message.content
            
            # ===== REAL-TIME CONFIDENCE EVALUATION =====
            confidence_scores = {}
            
            # 1. Domain Relevance Check (40% weight)
            dermatology_keywords = [
                'melanoma', 'skin', 'cancer', 'lesion', 'mole', 'dermatology', 
                'basal cell', 'squamous cell', 'carcinoma', 'biopsy', 'dermoscopy',
                'ABCDE', 'asymmetry', 'border', 'color', 'diameter', 'evolving',
                'nevus', 'keratosis', 'actinic', 'sun exposure', 'UV', 'pigment'
            ]
            query_lower = query.lower()
            answer_lower = answer.lower()
            
            # Check if query is in-domain
            query_keywords_found = sum(1 for kw in dermatology_keywords if kw in query_lower)
            domain_relevance = min(query_keywords_found / 3.0, 1.0)  # Normalize to 0-1
            confidence_scores['domain_relevance'] = domain_relevance
            
            # 2. Response Completeness (25% weight)
            # Check if answer addresses the query and has sufficient detail
            answer_length = len(answer.split())
            completeness = min(answer_length / 100.0, 1.0)  # 100+ words = complete
            
            # Bonus for structured content
            if any(marker in answer for marker in ['\n\n', '. ', '1.', '2.', '•', '-']):
                completeness = min(completeness + 0.15, 1.0)
            
            confidence_scores['completeness'] = completeness
            
            # 3. Medical Terminology (20% weight)
            # Check if response contains medical terms (shows expertise)
            answer_keywords_found = sum(1 for kw in dermatology_keywords if kw in answer_lower)
            terminology_score = min(answer_keywords_found / 5.0, 1.0)
            confidence_scores['terminology'] = terminology_score
            
            # 4. Model Certainty (15% weight)
            # Use model metadata if available
            model_certainty = 0.8  # Base for Groq models
            if hasattr(chat_completion, 'usage'):
                # Adjust based on token usage (longer = more thorough)
                tokens = getattr(chat_completion.usage, 'completion_tokens', 0)
                if tokens > 200:
                    model_certainty = 0.9
                elif tokens < 50:
                    model_certainty = 0.6
            confidence_scores['model_certainty'] = model_certainty
            
            # 5. Out-of-Scope Penalty
            # Penalize if the response tries to redirect or says "I don't know"
            out_of_scope_phrases = [
                "i don't know", "i cannot", "i'm not able", "outside my scope",
                "not qualified", "cannot provide", "beyond my expertise"
            ]
            penalty = 0.0
            for phrase in out_of_scope_phrases:
                if phrase in answer_lower:
                    penalty = 0.3
                    break
            
            # Calculate weighted confidence score
            final_confidence = (
                confidence_scores['domain_relevance'] * 0.40 +
                confidence_scores['completeness'] * 0.25 +
                confidence_scores['terminology'] * 0.20 +
                confidence_scores['model_certainty'] * 0.15
            ) - penalty
            
            # Clamp between 0 and 1
            final_confidence = max(0.0, min(1.0, final_confidence))
            
            # Round to 2 decimal places
            final_confidence = round(final_confidence, 2)
            
            # Add medical disclaimer
            answer += "\n\n⚠️ *Medical Disclaimer: This information is for educational purposes only. Please consult a qualified dermatologist for proper diagnosis and treatment.*"
            
            return {
                "answer": answer,
                "citations": [],  # Would come from vector store in full mode
                "confidence": final_confidence,
                "confidence_breakdown": {
                    "domain_relevance": round(confidence_scores['domain_relevance'], 2),
                    "completeness": round(confidence_scores['completeness'], 2),
                    "terminology": round(confidence_scores['terminology'], 2),
                    "model_certainty": round(confidence_scores['model_certainty'], 2),
                    "penalty_applied": penalty
                },
                "route": "answer",
                "session_id": session_id,
                "mode": "groq",
                "model_used": model
            }
        except Exception as e:
            print(f"Groq API error: {e}")
            return {
                "answer": f"I apologize, but I encountered an error: {str(e)}. Please try again.",
                "citations": [],
                "confidence": 0.0,
                "route": "answer",
                "session_id": session_id,
                "mode": "error"
            }
    else:
        # Fallback to mock response
        return {
            "answer": "This is a mock response. Please configure GROQ_API_KEY in .env file to use real AI responses.",
            "citations": [],
            "confidence": 0.0,
            "route": "answer",
            "session_id": session_id,
            "mode": "mock"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
