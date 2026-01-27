"""RAG Agent - Medical Q&A using vector store and LLM."""
import logging
import time
from typing import Dict, Any, Optional, List
from groq import Groq

from app.config import settings, MEDICAL_DISCLAIMER
from app.services.supabase_vector_store import supabase_vector_store
from app.mcp.policies import DomainPolicy, SafetyPolicy

logger = logging.getLogger(__name__)


class RAGAgent:
    """
    RAG Agent for medical Q&A.
    
    Pipeline:
    1. Policy checks (safety, domain)
    2. Vector store retrieval
    3. Grounding verification
    4. LLM generation with citations
    5. Confidence evaluation
    """
    
    def __init__(self):
        """Initialize RAG agent."""
        self.groq_client = None
        if settings.groq_api_key:
            self.groq_client = Groq(api_key=settings.groq_api_key)
    
    async def process(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        lesion_class: Optional[str] = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Process query through RAG pipeline with conversation awareness.
        
        Args:
            query: Medical question
            session_id: Session ID
            user_id: User ID
            lesion_class: Optional lesion class filter
            conversation_history: Optional conversation history for context
            
        Returns:
            Response with answer and citations
        """
        start_time = time.time()
        
        try:
            # ===== STEP 1: POLICY CHECKS =====
            safety_check = SafetyPolicy.check_query_safety(query)
            if not safety_check["safe"]:
                return self._create_refusal_response(
                    session_id,
                    f"Safety violation: {safety_check['violations'][0]['type']}"
                )
            
            in_scope = DomainPolicy.is_in_scope(query)
            if not in_scope:
                return self._create_refusal_response(
                    session_id,
                    "Query is outside dermatology scope"
                )
            
            # ===== STEP 2: VECTOR STORE RETRIEVAL =====
            documents = []
            if supabase_vector_store.is_ready():
                results = await supabase_vector_store.search(
                    query=query,
                    top_k=settings.top_k_documents,
                    match_threshold=0.3,
                    lesion_class=lesion_class
                )
                
                documents = [
                    {
                        "content": result.chunk_text,
                        "source": result.source or "Unknown",
                        "score": result.similarity,
                        "lesion_class": result.lesion_class
                    }
                    for result in results
                ]
            
            # ===== STEP 3: GROUNDING CHECK =====
            if documents:
                top_scores = [d["score"] for d in documents[:3]]
                avg_score = sum(top_scores) / len(top_scores)
                grounding_passed = avg_score >= 0.5
            else:
                grounding_passed = False
                avg_score = 0.0
            
            # ===== STEP 4: LLM GENERATION =====
            if not self.groq_client:
                raise RuntimeError("Groq client not initialized")
            
            # Prepare context
            if documents:
                context = "\\n\\n".join([
                    f"[Source: {doc['source']} (Relevance: {doc['score']:.2f})]\\n{doc['content']}"
                    for doc in documents[:5]
                ])
            else:
                context = "No specific guidelines found. Provide general dermatology education."
            
            # System prompt with conversation history if available
            system_prompt = (
                "You are MIDAS AI, a medical AI assistant specialized in dermatology and skin cancer. "
                "Provide educational, evidence-based responses grounded in the context provided. "
                "Always remind users to consult healthcare professionals."
            )
            
            # Add conversation history to system prompt if available
            if conversation_history and len(conversation_history) > 1:
                history_context = "\n\nRecent conversation context:\n"
                for msg in conversation_history[-4:]:  # Last 4 messages
                    role = msg.get("role", "unknown")
                    content = msg.get("content", "")[:200]  # First 200 chars
                    history_context += f"{role.capitalize()}: {content}...\n"
                system_prompt += history_context
            
            # ===== STEP 4.5: GENERATE INITIAL ANSWER =====
            user_prompt = f"""Context from knowledge base:
{context}

Question: {query}

Provide a detailed, comprehensive answer based on the context above. Cite your sources."""
            
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=settings.groq_model,
                temperature=settings.groq_temperature,
                max_tokens=settings.groq_max_tokens
            )
            
            answer = chat_completion.choices[0].message.content
            # Ensure answer is a string
            if answer is None:
                answer = ""
            answer = str(answer) if not isinstance(answer, str) else answer
            
            # ===== STEP 5: PRE-CHECK CONFIDENCE (AFTER generating answer) =====
            MIN_CONFIDENCE_THRESHOLD = 0.75
            initial_confidence = self._evaluate_confidence(
                query, answer, documents, grounding_passed
            )
            
            logger.info(f"Initial confidence: {initial_confidence['final']:.2%}")
            
            # If confidence is low, enhance retrieval and regenerate
            if initial_confidence["final"] < MIN_CONFIDENCE_THRESHOLD:
                logger.warning(f"Pre-generation low confidence: {initial_confidence['final']:.2f}, enhancing retrieval...")
                enhanced_results = await supabase_vector_store.search(
                    query=query,
                    top_k=15,  # Get more documents
                    match_threshold=0.2,  # Lower threshold
                    lesion_class=lesion_class
                )
                
                if enhanced_results and len(enhanced_results) > len(documents):
                    documents = [
                        {
                            "content": result.chunk_text,
                            "source": result.source or "Unknown",
                            "score": result.similarity,
                            "lesion_class": result.lesion_class
                        }
                        for result in enhanced_results
                    ]
                    
                    # Recalculate with enhanced documents
                    top_scores = [d["score"] for d in documents[:3]]
                    avg_score = sum(top_scores) / len(top_scores)
                    grounding_passed = avg_score >= 0.5
                    
                    enhanced_confidence = self._evaluate_confidence(
                        query, "", documents, grounding_passed
                    )
                    logger.info(f"Enhanced retrieval: {initial_confidence['final']:.2f} → {enhanced_confidence['final']:.2f}")
                    
                    # Regenerate context with enhanced documents
                    context = "\\n\\n".join([
                        f"[Source: {doc['source']} (Relevance: {doc['score']:.2f})]\\n{doc['content']}"
                        for doc in documents[:7]  # Use more documents
                    ])
                    
                    # Regenerate with enhanced context
                    user_prompt = f"""Context from knowledge base:
{context}

Question: {query}

Provide a detailed, comprehensive answer based on the context above. Cite your sources."""
                    
                    chat_completion = self.groq_client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        model=settings.groq_model,
                        temperature=settings.groq_temperature,
                        max_tokens=settings.groq_max_tokens
                    )
                    
                    answer = chat_completion.choices[0].message.content
                    # Ensure answer is a string
                    if answer is None:
                        answer = ""
                    answer = str(answer) if not isinstance(answer, str) else answer
                    
                    # Re-evaluate confidence with new answer
                    initial_confidence = self._evaluate_confidence(
                        query, answer, documents, grounding_passed
                    )
            
            # ===== STEP 6: FINAL CONFIDENCE EVALUATION =====
            confidence_scores = initial_confidence
            
            # Boost confidence if we used enhanced retrieval
            if len(documents) > 10:
                confidence_scores["final"] = min(confidence_scores["final"] * 1.1, 1.0)
                confidence_scores["breakdown"]["enhanced_retrieval"] = True
            
            # Ensure answer is a string and add disclaimer
            answer_text = str(answer) if answer else ""
            if MEDICAL_DISCLAIMER.strip() not in answer_text:
                answer_text += MEDICAL_DISCLAIMER
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Create citations
            citations = [
                {
                    "source": doc["source"],
                    "content": doc["content"][:300] + "...",
                    "relevance_score": doc["score"],
                    "lesion_class": doc.get("lesion_class"),
                    "source_type": "knowledge_base"
                }
                for doc in documents[:5]
            ]
            
            return {
                "answer": answer_text,
                "citations": citations,
                "confidence": float(confidence_scores["final"]),
                "confidence_breakdown": confidence_scores["breakdown"],
                "route": "answer",
                "session_id": session_id,
                "model_used": settings.groq_model,
                "mode": "rag_agent",
                "latency_ms": latency_ms,
                "source_confidence": {
                    "has_web_sources": False,
                    "source_type": "knowledge_base",
                    "confidence": "high" if grounding_passed else "medium"
                }
            }
            
        except Exception as e:
            logger.error(f"RAG Agent error: {e}")
            return {
                "answer": f"I apologize, but I encountered an error: {str(e)}{MEDICAL_DISCLAIMER}",
                "citations": [],
                "confidence": 0.0,
                "route": "error",
                "session_id": session_id,
                "model_used": "error",
                "mode": "error"
            }
    
    def _evaluate_confidence(
        self,
        query: str,
        answer: str,
        documents: List[Dict],
        grounding_passed: bool
    ) -> Dict[str, Any]:
        """Evaluate confidence (simplified version)."""
        if not documents:
            return {"final": float(0.3), "breakdown": {}}
        
        avg_score = sum(d["score"] for d in documents[:3]) / min(3, len(documents))
        final_confidence = min(avg_score * 1.2, 1.0) if grounding_passed else avg_score * 0.8
        
        return {
            "final": float(round(final_confidence, 2)),
            "breakdown": {
                "retrieval_quality": float(round(avg_score, 2)),
                "grounding_passed": grounding_passed
            }
        }
    
    def _create_refusal_response(self, session_id: str, reason: str) -> Dict[str, Any]:
        """Create refusal response."""
        return {
            "answer": (
                "I apologize, but I can only answer questions specifically about skin cancer "
                "and dermatology. Your question appears to be outside this scope."
            ),
            "citations": [],
            "confidence": 0.0,
            "route": "refuse",
            "session_id": session_id,
            "model_used": "policy",
            "mode": "rag_agent"
        }


# Global RAG agent instance
rag_agent = RAGAgent()
