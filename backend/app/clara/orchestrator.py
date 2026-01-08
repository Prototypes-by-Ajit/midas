"""CLARA orchestrator - main agentic RAG coordinator."""
from typing import Optional, Dict, Any, List
from datetime import datetime
import time
import logging

from app.mcp.policies import DomainPolicy, SafetyPolicy
from app.cache import embedding_cache, retrieval_cache, generation_cache
from app.services.vector_store import vector_store
from app.services.llm_service import llm_service
from app.models.schemas import ChatResponse, Citation, RouteType
from app.config import settings, MEDICAL_DISCLAIMER

logger = logging.getLogger(__name__)


class CLARAOrchestrator:
    """
    CLARA: Context-aware LLM Agentic RAG Architecture
    
    Orchestrates the full RAG pipeline with caching, grounding, and safety.
    """
    
    def __init__(self):
        """Initialize CLARA orchestrator."""
        self.use_caching = settings.enable_caching
        self.require_grounding = settings.enable_grounding_verification
        self.min_grounding_score = settings.min_grounding_score
    
    async def process_query(
        self,
        query: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        lesion_class: Optional[str] = None
    ) -> ChatResponse:
        """
        Process a query through the CLARA pipeline.
        
        Flow:
        1. Policy routing (domain check)
        2. Retrieval (with cache)
        3. Grounding verification
        4. Generation (with cache)
        5. Response composition
        
        Args:
            query: User's question
            user_id: User ID
            session_id: Session ID
            lesion_class: Optional lesion class filter
            
        Returns:
            ChatResponse with answer, citations, and metadata
        """
        start_time = time.time()
        
        # Track cache hits
        cache_hits = {
            "embedding": False,
            "retrieval": False,
            "generation": False
        }
        
        try:
            # Step 1: Policy Routing (Domain Check)
            logger.info(f"CLARA: Processing query: {query[:100]}...")
            
            # Safety check
            safety_check = SafetyPolicy.check_query_safety(query)
            if not safety_check["safe"]:
                return self._create_refusal_response(
                    query, 
                    f"Safety violation: {safety_check['violations'][0]['type']}",
                    session_id
                )
            
            # Domain check
            in_scope = DomainPolicy.is_in_scope(query)
            if not in_scope:
                reason = DomainPolicy.get_refusal_reason(query)
                return self._create_refusal_response(query, reason, session_id)
            
            logger.info("✓ Query passed policy checks")
            
            # Step 2: Retrieval (with cache)
            filters = {"lesion_class": lesion_class} if lesion_class else {}
            
            # Check retrieval cache
            if self.use_caching:
                cached_results = retrieval_cache.get(
                    query, 
                    filters, 
                    settings.doc_index_version,
                    settings.top_k_documents
                )
                if cached_results:
                    documents = cached_results
                    cache_hits["retrieval"] = True
                    logger.info("✓ Retrieval cache hit")
                else:
                    documents = self._retrieve_documents(query, filters)
                    # Cache the results
                    retrieval_cache.set(
                        query, filters, settings.doc_index_version,
                        settings.top_k_documents, documents
                    )
            else:
                documents = self._retrieve_documents(query, filters)
            
            if not documents:
                return self._create_clarification_response(query, session_id)
            
            logger.info(f"✓ Retrieved {len(documents)} documents")
            
            # Step 3: Grounding Check (simplified)
            # In full implementation, this would be more sophisticated
            avg_score = sum(d.get("score", 0) for d in documents) / len(documents)
            grounding_passed = avg_score >= self.min_grounding_score
            
            if self.require_grounding and not grounding_passed:
                logger.warning(f"✗ Grounding failed: avg_score={avg_score:.3f}")
                return self._create_clarification_response(query, session_id)
            
            logger.info(f"✓ Grounding passed: score={avg_score:.3f}")
            
            # Step 4: Generation (with cache)
            evidence_ids = [d.get("id", f"doc_{i}") for i, d in enumerate(documents)]
            
            # Check generation cache
            if self.use_caching:
                system_prompt = "You are a medical AI assistant for skin cancer education."
                cached_generation = generation_cache.get(
                    system_prompt, query, evidence_ids,
                    settings.llm_version, settings.doc_index_version
                )
                if cached_generation:
                    answer = cached_generation["response"]
                    citations_data = cached_generation["citations"]
                    cache_hits["generation"] = True
                    logger.info("✓ Generation cache hit")
                else:
                    answer, citations_data = await self._generate_answer(query, documents)
                    # Cache only if grounded
                    generation_cache.set(
                        system_prompt, query, evidence_ids,
                        settings.llm_version, settings.doc_index_version,
                        answer, citations_data, grounding_passed
                    )
            else:
                answer, citations_data = await self._generate_answer(query, documents)
            
            logger.info("✓ Answer generated")
            
            # Step 5: Create response
            citations = [
                Citation(
                    source=c.get("source", "Unknown"),
                    content=c.get("content", ""),
                    relevance_score=c.get("score", 0.0)
                )
                for c in citations_data
            ]
            
            elapsed_time = time.time() - start_time
            logger.info(f"✓ CLARA completed in {elapsed_time:.2f}s (cache hits: {sum(cache_hits.values())}/3)")
            
            return ChatResponse(
                answer=answer,
                citations=citations,
                confidence=avg_score,
                route=RouteType.ANSWER,
                session_id=session_id,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"CLARA error: {e}", exc_info=True)
            return ChatResponse(
                answer=f"I apologize, but I encountered an error processing your question. Please try again.{MEDICAL_DISCLAIMER}",
                citations=[],
                confidence=0.0,
                route=RouteType.REFUSE,
                session_id=session_id,
                timestamp=datetime.utcnow()
            )
    
    def _retrieve_documents(self, query: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Retrieve documents from vector store.
        
        Args:
            query: Search query
            filters: Metadata filters
            
        Returns:
            List of documents with scores
        """
        try:
            # Use existing vector store
            docs = vector_store.search(query, top_k=settings.top_k_documents)
            
            # Convert to dict format
            return [
                {
                    "id": f"chunk_{i}",
                    "content": doc.content,
                    "score": doc.score,
                    "source": doc.metadata.get("source", "Unknown"),
                    "metadata": doc.metadata
                }
                for i, doc in enumerate(docs)
            ]
        except Exception as e:
            logger.error(f"Retrieval error: {e}")
            return []
    
    async def _generate_answer(
        self, 
        query: str, 
        documents: List[Dict[str, Any]]
    ) -> tuple[str, List[Dict[str, Any]]]:
        """
        Generate answer from documents using LLM.
        
        Args:
            query: User query
            documents: Retrieved documents
            
        Returns:
            Tuple of (answer, citations)
        """
        # Prepare context
        context = "\n\n".join([
            f"[Source: {doc.get('source', 'Unknown')}]\n{doc.get('content', '')}"
            for doc in documents[:3]  # Top 3 for context
        ])
        
        prompt = f"""You are a medical AI assistant specializing in skin cancer education.

Question: {query}

Context:
{context}

Instructions:
- Provide an educational answer based ONLY on the context provided
- If the context doesn't contain enough information, say so
- Focus on the 7 approved lesion types: Melanoma, Nevus, BCC, Actinic Keratosis, Benign Keratosis, Dermatofibroma, Vascular Lesions
- Keep answers clear and educational
- Cite sources when possible

Answer:"""
        
        try:
            answer = await llm_service.generate(
                prompt=prompt,
                temperature=settings.ollama_temperature,
                max_tokens=settings.ollama_max_tokens
            )
            
            # Ensure disclaimer
            if MEDICAL_DISCLAIMER.strip() not in answer:
                answer = answer + MEDICAL_DISCLAIMER
            
            # Create citations
            citations = [
                {
                    "source": doc.get("source", "Unknown"),
                    "content": doc.get("content", "")[:200] + "...",
                    "score": doc.get("score", 0.0)
                }
                for doc in documents[:3]
            ]
            
            return answer, citations
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return f"I apologize, but I couldn't generate a response.{MEDICAL_DISCLAIMER}", []
    
    def _create_refusal_response(
        self, 
        query: str, 
        reason: str,
        session_id: Optional[str]
    ) -> ChatResponse:
        """Create refusal response for out-of-scope queries."""
        answer = (
            "I apologize, but I can only answer questions specifically about skin cancer "
            "and the 7 approved lesion types (Melanoma, Nevus, Basal Cell Carcinoma, "
            "Actinic Keratosis, Benign Keratosis, Dermatofibroma, and Vascular Lesions).\n\n"
            "Your question appears to be outside this scope. "
            "If you have questions about skin cancer, I'd be happy to help!"
        )
        
        return ChatResponse(
            answer=answer,
            citations=[],
            confidence=0.0,
            route=RouteType.REFUSE,
            session_id=session_id,
            timestamp=datetime.utcnow()
        )
    
    def _create_clarification_response(
        self,
        query: str,
        session_id: Optional[str]
    ) -> ChatResponse:
        """Create clarification request."""
        answer = (
            "I'd like to help answer your question, but I need a bit more information "
            "or couldn't find sufficient evidence in my knowledge base.\n\n"
            "Could you please:\n"
            "- Provide more specific details about your question?\n"
            "- Rephrase your question to focus on skin cancer or lesion characteristics?\n\n"
            "If this concerns a personal health matter, please consult a dermatologist "
            "for proper evaluation."
            f"{MEDICAL_DISCLAIMER}"
        )
        
        return ChatResponse(
            answer=answer,
            citations=[],
            confidence=0.3,
            route=RouteType.CLARIFY,
            session_id=session_id,
            timestamp=datetime.utcnow()
        )


# Global orchestrator instance
clara_orchestrator = CLARAOrchestrator()
