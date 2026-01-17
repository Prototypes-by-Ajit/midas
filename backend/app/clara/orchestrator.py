"""CLARA orchestrator - main agentic RAG coordinator."""
from typing import Optional, Dict, Any, List
from datetime import datetime
import time
import logging

from app.mcp.policies import DomainPolicy, SafetyPolicy
from app.cache import embedding_cache, retrieval_cache, generation_cache
from app.services.supabase_vector_store import supabase_vector_store
from app.services.llm_service import llm_service
from app.models.schemas import ChatResponse, Citation, RouteType
from app.config import settings, MEDICAL_DISCLAIMER

logger = logging.getLogger(__name__)

# Lazy import for hybrid retriever (only if enabled)
hybrid_retriever = None


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

        # Initialize hybrid retriever if Layer 1 is enabled
        self.hybrid_retriever = None
        if settings.enable_hybrid_retrieval:
            try:
                from app.services.hybrid_retriever import HybridRetriever
                from app.services.supabase_vector_store import supabase_vector_store

                self.hybrid_retriever = HybridRetriever(supabase_vector_store)
                logger.info("✓ Layer 1 (Hybrid Retrieval) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize hybrid retriever: {e}")
                logger.warning("Falling back to standard retrieval")

        # Initialize planner agent if Layer 2 is enabled
        self.planner = None
        if settings.enable_planner:
            try:
                from app.agents.planner_agent import PlannerAgent

                self.planner = PlannerAgent(
                    llm_service=llm_service,
                    max_steps=settings.planner_max_steps
                )
                logger.info("✓ Layer 2 (Planner Agent) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize planner agent: {e}")
                logger.warning("Falling back to direct retrieval")

        # Initialize evidence grader if Layer 3 is enabled
        self.evidence_grader = None
        if settings.enable_evidence_grading:
            try:
                from app.agents.evidence_grader import EvidenceGrader

                self.evidence_grader = EvidenceGrader(
                    llm_service=llm_service,
                    min_score=settings.min_evidence_score
                )
                logger.info("✓ Layer 3 (Evidence Grading) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize evidence grader: {e}")
                logger.warning("Falling back to standard retrieval")

        # Initialize citation verifier if Layer 3 is enabled
        self.citation_verifier = None
        if settings.enable_citation_verification:
            try:
                from app.agents.citation_verifier import CitationVerifier

                self.citation_verifier = CitationVerifier(
                    llm_service=llm_service,
                    min_confidence=0.7
                )
                logger.info("✓ Layer 3 (Citation Verification) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize citation verifier: {e}")
                logger.warning("Falling back to standard generation")

        # Initialize conversation memory if Layer 4 is enabled
        self.memory = None
        if settings.enable_conversation_memory:
            try:
                from app.agents.memory_agent import ConversationMemory
                from app.services.supabase_vector_store import supabase_client

                self.memory = ConversationMemory(
                    supabase_client=supabase_client,
                    memory_k=settings.memory_k,
                    ttl_days=settings.memory_ttl_days
                )
                logger.info("✓ Layer 4 (Conversation Memory) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize conversation memory: {e}")
                logger.warning("Continuing without memory")

        # Initialize guardrail agent if Layer 5 is enabled
        self.guardrails = None
        if settings.enable_enhanced_guardrails:
            try:
                from app.agents.guardrail_agent import GuardrailAgent

                self.guardrails = GuardrailAgent(llm_service=llm_service)
                logger.info("✓ Layer 5 (Enhanced Guardrails) ENABLED")
            except Exception as e:
                logger.error(f"Failed to initialize guardrail agent: {e}")
                logger.warning("Continuing with basic guardrails only")
    
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

            # LAYER 5: Input Guardrails (if enabled)
            if settings.enable_input_guardrails and self.guardrails:
                logger.debug("Using Layer 5: Input Guardrails")
                input_check = await self.guardrails.check_input(query)

                if not input_check["is_safe"]:
                    logger.warning(f"✗ Input guardrail violations: {input_check['violations']}")
                    return self._create_refusal_response(
                        query,
                        input_check.get("warning", "Your query violates content policies"),
                        session_id
                    )

                logger.info("✓ Input guardrails passed")

            # LAYER 4: Conversation Memory (if enabled)
            # Retrieve relevant past interactions for context
            conversation_context = None
            if settings.enable_conversation_memory and self.memory and user_id:
                try:
                    logger.debug("Using Layer 4: Conversation Memory")
                    history = await self.memory.get_relevant_history(user_id, query)

                    if history:
                        conversation_context = self.memory.format_history_for_prompt(history)
                        logger.info(f"✓ Retrieved {len(history)} relevant past interactions")
                except Exception as e:
                    logger.warning(f"Memory retrieval error: {e}, continuing without history")

            # LAYER 2: Planner Agent (if enabled)
            # Routes complex queries through multi-step planning
            if settings.enable_planner and self.planner:
                logger.info("Using Layer 2: Planner Agent (ReAct pattern)")
                return await self._process_with_planner(
                    query=query,
                    session_id=session_id,
                    lesion_class=lesion_class,
                    start_time=start_time,
                    cache_hits=cache_hits
                )

            # EXISTING PATH: Direct retrieval + generation
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
                    documents = await self._retrieve_documents(query, filters)
                    # Cache the results
                    retrieval_cache.set(
                        query, filters, settings.doc_index_version,
                        settings.top_k_documents, documents
                    )
            else:
                documents = await self._retrieve_documents(query, filters)

            if not documents:
                return self._create_clarification_response(query, session_id)

            logger.info(f"✓ Retrieved {len(documents)} documents")

            # LAYER 3: Evidence Grading (if enabled)
            if settings.enable_evidence_grading and self.evidence_grader:
                logger.debug("Using Layer 3: Evidence Grading")
                documents = await self.evidence_grader.grade_documents(query, documents)

                if not documents:
                    logger.warning("✗ All documents failed evidence grading")
                    return self._create_clarification_response(query, session_id)

                logger.info(f"✓ Evidence grading: {len(documents)} documents passed")
            
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

            # LAYER 3: Citation Verification (if enabled)
            verification_result = None
            if settings.enable_citation_verification and self.citation_verifier:
                logger.debug("Using Layer 3: Citation Verification")
                verification_result = await self.citation_verifier.verify_answer(answer, documents)

                # Log warnings if any
                if verification_result.get("warnings"):
                    for warning in verification_result["warnings"]:
                        logger.warning(f"Citation warning: {warning}")

                logger.info(
                    f"✓ Citation verification: {verification_result.get('confidence', 0):.2f} "
                    f"grounding confidence"
                )
            
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

            # Build metadata
            metadata = {
                "cache_hits": cache_hits
            }

            # Add verification metadata if available
            if verification_result:
                metadata["citation_verification"] = {
                    "is_grounded": verification_result.get("is_grounded", True),
                    "confidence": verification_result.get("confidence", 0.0),
                    "warnings": verification_result.get("warnings", [])
                }

            # LAYER 5: Output Guardrails (if enabled)
            if settings.enable_output_guardrails and self.guardrails:
                logger.debug("Using Layer 5: Output Guardrails")
                output_check = await self.guardrails.check_output(answer, query)

                if output_check.get("violations"):
                    logger.warning(f"Output guardrail violations: {output_check['violations']}")

                # Add guardrail metadata
                metadata["output_guardrails"] = {
                    "is_safe": output_check.get("is_safe", True),
                    "violations": output_check.get("violations", []),
                    "requires_disclaimer": output_check.get("requires_disclaimer", False)
                }

                logger.info("✓ Output guardrails checked")

            # LAYER 4: Store interaction in memory (if enabled)
            if settings.enable_conversation_memory and self.memory and user_id and session_id:
                try:
                    await self.memory.add_interaction(
                        user_id=user_id,
                        session_id=session_id,
                        query=query,
                        answer=answer,
                        metadata={
                            "confidence": avg_score,
                            "grounding_passed": grounding_passed,
                            "verification": verification_result
                        }
                    )
                    logger.debug("✓ Interaction stored in memory")
                except Exception as e:
                    logger.warning(f"Failed to store interaction: {e}")

            return ChatResponse(
                answer=answer,
                citations=citations,
                confidence=avg_score,
                route=RouteType.ANSWER,
                session_id=session_id,
                timestamp=datetime.utcnow(),
                metadata=metadata
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
    
    async def _process_with_planner(
        self,
        query: str,
        session_id: Optional[str],
        lesion_class: Optional[str],
        start_time: float,
        cache_hits: Dict[str, bool]
    ) -> ChatResponse:
        """
        Process query using planner agent (Layer 2).

        Args:
            query: User query
            session_id: Session ID
            lesion_class: Optional lesion class filter
            start_time: Query start time
            cache_hits: Cache hit tracking dict

        Returns:
            ChatResponse with planner-guided answer
        """
        try:
            # Create retrieval function for planner
            async def retrieval_fn(q: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
                """Retrieval function for planner agent."""
                filters = {"lesion_class": lesion_class} if lesion_class else {}
                return await self._retrieve_documents(q, filters)

            # Run planner
            logger.info("Planner: Analyzing query for multi-step reasoning...")
            planner_result = await self.planner.run(
                query=query,
                context=None,  # Can add memory context here in Phase 4
                retrieval_fn=retrieval_fn
            )

            final_answer = planner_result.get("final_answer", "")
            planning_used = planner_result.get("planning_used", False)
            plan_steps = planner_result.get("plan", [])

            logger.info(f"Planner: {'Multi-step planning' if planning_used else 'Direct answering'} used")

            # Ensure medical disclaimer
            if MEDICAL_DISCLAIMER.strip() not in final_answer:
                final_answer = final_answer + MEDICAL_DISCLAIMER

            # Extract citations from observations (if available)
            observations = planner_result.get("observations", [])
            citations = []

            # Try to extract document references from observations
            # For now, create simple citations from observations
            for i, obs in enumerate(observations[:3]):
                citations.append(
                    Citation(
                        source=f"Planner observation {i+1}",
                        content=obs[:200] if isinstance(obs, str) else str(obs)[:200],
                        relevance_score=0.8  # Default score for planner results
                    )
                )

            elapsed_time = time.time() - start_time
            logger.info(f"✓ CLARA (with Planner) completed in {elapsed_time:.2f}s")

            return ChatResponse(
                answer=final_answer,
                citations=citations,
                confidence=0.85 if planning_used else 0.75,  # Higher confidence for planned responses
                route=RouteType.ANSWER,
                session_id=session_id,
                timestamp=datetime.utcnow(),
                metadata={
                    "planning_used": planning_used,
                    "plan_steps": len(plan_steps),
                    "planner_enabled": True
                }
            )

        except Exception as e:
            logger.error(f"Planner error: {e}, falling back to direct retrieval")
            # Fallback to standard CLARA flow
            filters = {"lesion_class": lesion_class} if lesion_class else {}
            documents = await self._retrieve_documents(query, filters)

            if not documents:
                return self._create_clarification_response(query, session_id)

            answer, citations_data = await self._generate_answer(query, documents)

            citations = [
                Citation(
                    source=c.get("source", "Unknown"),
                    content=c.get("content", ""),
                    relevance_score=c.get("score", 0.0)
                )
                for c in citations_data
            ]

            elapsed_time = time.time() - start_time

            return ChatResponse(
                answer=answer,
                citations=citations,
                confidence=0.7,
                route=RouteType.ANSWER,
                session_id=session_id,
                timestamp=datetime.utcnow(),
                metadata={"planner_fallback": True}
            )

    async def _retrieve_documents(self, query: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Retrieve documents from vector store with optional hybrid retrieval.

        Layer 1 Enhancement:
        - If enable_hybrid_retrieval=False: uses Supabase pgvector (dense only)
        - If enable_hybrid_retrieval=True: uses hybrid BM25 + pgvector + reranking

        Args:
            query: Search query
            filters: Metadata filters (e.g., lesion_class)

        Returns:
            List of documents with scores
        """
        try:
            # LAYER 1: Hybrid Retrieval (if enabled)
            if settings.enable_hybrid_retrieval and self.hybrid_retriever:
                logger.debug("Using Layer 1: Hybrid Retrieval (BM25 + pgvector + reranking)")

                lesion_class = filters.get("lesion_class")

                docs = await self.hybrid_retriever.retrieve(
                    query=query,
                    top_k=settings.hybrid_retrieval_top_k,
                    rerank_top_n=settings.hybrid_retrieval_rerank_top_n,
                    lesion_class=lesion_class,
                    rrf_k=settings.hybrid_retrieval_rrf_k
                )

                # Convert to CLARA format
                return [
                    {
                        "id": doc.get("id", f"chunk_{i}"),
                        "content": doc.get("chunk_text", doc.get("content", "")),
                        "score": doc.get("rerank_score", doc.get("score", 0)),
                        "source": doc.get("source", "Unknown"),
                        "metadata": doc.get("metadata", {}),
                        "retrieval_method": "hybrid"  # Tag for debugging
                    }
                    for i, doc in enumerate(docs)
                ]

            # EXISTING PATH: Standard dense retrieval
            else:
                logger.debug("Using standard dense retrieval (pgvector only)")

                if not supabase_vector_store.is_ready():
                    raise RuntimeError("Supabase vector store not initialized")

                results = await supabase_vector_store.search(
                    query=query,
                    top_k=settings.top_k_documents,
                    match_threshold=0.3,
                    lesion_class=filters.get("lesion_class")
                )

                # Convert to dict format
                return [
                    {
                        "id": doc.document_id,
                        "content": doc.chunk_text,
                        "score": doc.similarity,
                        "source": doc.source or "Unknown",
                        "metadata": doc.metadata,
                        "retrieval_method": "dense"  # Tag for debugging
                    }
                    for doc in results
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
