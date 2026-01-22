"""Evidence grader agent for context evaluation."""
from typing import List
from app.services.llm_service import llm_service
from app.models.schemas import Document, GraderOutput
from app.utils.prompts import EVIDENCE_GRADER_PROMPT
from app.config import settings


class EvidenceGrader:
    """Agent that evaluates whether retrieved context is sufficient."""
    
    async def grade(self, query: str, documents: List[Document]) -> GraderOutput:
        """
        Grade the quality and sufficiency of retrieved evidence.
        
        Args:
            query: User's question
            documents: Retrieved documents
            
        Returns:
            GraderOutput with sufficiency assessment
        """
        if not documents:
            return GraderOutput(
                sufficient=False,
                confidence=1.0,
                reason="No documents retrieved"
            )
        
        # Combine document contents
        context = "\n\n".join([
            f"[Document {i+1}] (Score: {doc.score:.2f})\n{doc.content}"
            for i, doc in enumerate(documents)
        ])
        
        # Check if we have high confidence documents
        high_conf_docs = [d for d in documents if d.score > settings.min_confidence_threshold]
        
        if not high_conf_docs:
            return GraderOutput(
                sufficient=False,
                confidence=0.8,
                reason="Retrieved documents have low relevance scores"
            )
        
        # Use LLM to grade evidence
        prompt = EVIDENCE_GRADER_PROMPT.format(query=query, context=context)
        
        try:
            result = await llm_service.generate_json(prompt)
            
            if "error" in result:
                # Fallback: if we have high-confidence docs, assume sufficient
                return GraderOutput(
                    sufficient=len(high_conf_docs) >= 2,
                    confidence=0.6,
                    reason="LLM unavailable - using score-based heuristic"
                )
            
            sufficient = result.get("sufficient", False)
            confidence = result.get("confidence", 0.5)
            reason = result.get("reason", "")
            
            return GraderOutput(
                sufficient=sufficient,
                confidence=confidence,
                reason=reason
            )
            
        except Exception as e:
            print(f"Error in grader: {e}")
            # Fallback
            return GraderOutput(
                sufficient=len(high_conf_docs) >= 2,
                confidence=0.5,
                reason="Error in grading - using fallback"
            )


# Global grader instance
evidence_grader = EvidenceGrader()
