"""Response generator agent for creating answers."""
from typing import List
from app.services.llm_service import llm_service
from app.models.schemas import Document, Citation
from app.utils.prompts import (
    RESPONSE_GENERATOR_PROMPT,
    CLARIFICATION_PROMPT,
    REFUSAL_PROMPT
)
from app.config import MEDICAL_DISCLAIMER


class ResponseGenerator:
    """Agent that generates responses with citations."""
    
    async def generate_answer(
        self,
        query: str,
        documents: List[Document]
    ) -> tuple[str, List[Citation]]:
        """
        Generate an answer from retrieved documents.
        
        Args:
            query: User's question
            documents: Retrieved documents
            
        Returns:
            Tuple of (answer text, list of citations)
        """
        # Prepare context
        context = "\n\n".join([
            f"[Source: {doc.metadata.get('source', 'Unknown')}]\n{doc.content}"
            for doc in documents
        ])
        
        prompt = RESPONSE_GENERATOR_PROMPT.format(query=query, context=context)
        
        try:
            answer = await llm_service.generate(prompt, temperature=0.3)
            
            # Ensure disclaimer is present
            if MEDICAL_DISCLAIMER.strip() not in answer:
                answer = answer + MEDICAL_DISCLAIMER
            
            # Create citations from documents
            citations = [
                Citation(
                    source=doc.metadata.get("source", "Unknown"),
                    content=doc.content[:200] + "...",  # Truncate for display
                    relevance_score=doc.score
                )
                for doc in documents[:3]  # Top 3 citations
            ]
            
            return answer, citations
            
        except Exception as e:
            print(f"Error in generator: {e}")
            fallback = (
                f"I apologize, but I'm having trouble generating a response right now. "
                f"Your question was about: {query}\n\n"
                f"Please try again or rephrase your question."
                f"{MEDICAL_DISCLAIMER}"
            )
            return fallback, []
    
    async def generate_clarification(self, query: str) -> str:
        """
        Generate a clarification request for ambiguous queries.
        
        Args:
            query: User's ambiguous question
            
        Returns:
            Clarification message
        """
        prompt = CLARIFICATION_PROMPT.format(query=query)
        
        try:
            response = await llm_service.generate(prompt, temperature=0.5)
            return response + MEDICAL_DISCLAIMER
        except Exception as e:
            print(f"Error generating clarification: {e}")
            return (
                "I'd like to help answer your question, but I need a bit more information. "
                "Could you please provide more details about what you're asking? "
                "If this is about a personal health concern, I strongly encourage "
                "consulting with a dermatologist for proper evaluation."
                f"{MEDICAL_DISCLAIMER}"
            )
    
    async def generate_refusal(self, query: str, detected_topic: str = "general") -> str:
        """
        Generate a polite refusal for out-of-scope queries.
        
        Args:
            query: User's out-of-scope question
            detected_topic: The topic detected (if any)
            
        Returns:
            Refusal message
        """
        prompt = REFUSAL_PROMPT.format(query=query, detected_topic=detected_topic)
        
        try:
            response = await llm_service.generate(prompt, temperature=0.4)
            return response
        except Exception as e:
            print(f"Error generating refusal: {e}")
            return (
                "I apologize, but I can only answer questions specifically related to skin cancer "
                "(melanoma, basal cell carcinoma, squamous cell carcinoma), their detection, "
                "risk factors, prevention, and general treatment information.\n\n"
                "Your question appears to be about a different topic. "
                "I'd recommend consulting appropriate medical resources or healthcare "
                "professionals for information on other health topics.\n\n"
                "If you have any questions about skin cancer, I'd be happy to help!"
            )


# Global generator instance
response_generator = ResponseGenerator()
