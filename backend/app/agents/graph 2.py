"""Agentic orchestrator for RAG control flow."""
from typing import Optional
from app.agents.router import domain_router
from app.agents.retriever import retriever
from app.agents.grader import evidence_grader
from app.agents.generator import response_generator
from app.models.schemas import ChatResponse, Citation
from datetime import datetime


class AgenticOrchestrator:
    """Orchestrates the agentic RAG flow."""
    
    async def process_query(
        self,
        query: str,
        session_id: Optional[str] = None
    ) -> ChatResponse:
        """
        Process a query through the agentic RAG pipeline.
        
        Flow:
        1. Route query (in-scope, out-of-scope, or clarify)
        2. If in-scope: Retrieve documents
        3. Grade evidence sufficiency
        4. Generate response with citations
        
        Args:
            query: User's question
            session_id: Optional session ID
            
        Returns:
            ChatResponse with answer and metadata
        """
        print(f"\n{'='*60}")
        print(f"Processing query: {query}")
        print(f"{'='*60}\n")
        
        # Step 1: Route the query
        print("Step 1: Routing query...")
        router_output = await domain_router.route(query)
        print(f"  Route: {router_output.route}")
        print(f"  In scope: {router_output.in_scope}")
        print(f"  Confidence: {router_output.confidence:.2f}")
        print(f"  Reason: {router_output.reason}\n")
        
        # Step 2: Handle based on route
        if router_output.route == "refuse":
            # Out of scope - refuse
            print("Step 2: Generating refusal...")
            answer = await response_generator.generate_refusal(
                query,
                detected_topic=router_output.reason
            )
            return ChatResponse(
                answer=answer,
                citations=[],
                confidence=router_output.confidence,
                route="refuse",
                session_id=session_id,
                timestamp=datetime.utcnow()
            )
        
        elif router_output.route == "clarify":
            # Ambiguous - ask for clarification
            print("Step 2: Generating clarification...")
            answer = await response_generator.generate_clarification(query)
            return ChatResponse(
                answer=answer,
                citations=[],
                confidence=router_output.confidence,
                route="clarify",
                session_id=session_id,
                timestamp=datetime.utcnow()
            )
        
        else:  # route == "answer"
            # In scope - proceed with RAG
            print("Step 2: Retrieving documents...")
            documents = await retriever.retrieve(query)
            print(f"  Retrieved {len(documents)} documents\n")
            
            if not documents:
                # No documents found
                print("  No documents found - generating clarification...")
                answer = await response_generator.generate_clarification(query)
                return ChatResponse(
                    answer=answer,
                    citations=[],
                    confidence=0.3,
                    route="clarify",
                    session_id=session_id,
                    timestamp=datetime.utcnow()
                )
            
            # Step 3: Grade evidence
            print("Step 3: Grading evidence...")
            grade_output = await evidence_grader.grade(query, documents)
            print(f"  Sufficient: {grade_output.sufficient}")
            print(f"  Confidence: {grade_output.confidence:.2f}")
            print(f"  Reason: {grade_output.reason}\n")
            
            if not grade_output.sufficient:
                # Insufficient evidence
                print("  Evidence insufficient - generating clarification...")
                answer = await response_generator.generate_clarification(query)
                return ChatResponse(
                    answer=answer,
                    citations=[],
                    confidence=grade_output.confidence,
                    route="clarify",
                    session_id=session_id,
                    timestamp=datetime.utcnow()
                )
            
            # Step 4: Generate answer
            print("Step 4: Generating answer...")
            answer, citations = await response_generator.generate_answer(query, documents)
            print(f"  Answer generated with {len(citations)} citations\n")
            
            # Calculate overall confidence
            overall_confidence = min(
                router_output.confidence * 0.4 +
                grade_output.confidence * 0.3 +
                (sum(d.score for d in documents[:3]) / len(documents[:3])) * 0.3,
                1.0
            )
            
            return ChatResponse(
                answer=answer,
                citations=citations,
                confidence=overall_confidence,
                route="answer",
                session_id=session_id,
                timestamp=datetime.utcnow()
            )


# Global orchestrator instance
orchestrator = AgenticOrchestrator()
