"""Domain router agent for query classification."""
from app.services.llm_service import llm_service
from app.models.schemas import RouterOutput
from app.utils.prompts import ROUTER_PROMPT
from app.config import IN_SCOPE_TOPICS


class DomainRouter:
    """Agent that classifies queries as in-scope, out-of-scope, or ambiguous."""
    
    async def route(self, query: str) -> RouterOutput:
        """
        Classify query and determine routing.
        
        Args:
            query: User's question
            
        Returns:
            RouterOutput with classification and routing decision
        """
        # Quick keyword check first
        query_lower = query.lower()
        has_scope_keywords = any(topic in query_lower for topic in IN_SCOPE_TOPICS)
        
        # Use LLM for classification
        prompt = ROUTER_PROMPT.format(query=query)
        
        try:
            result = await llm_service.generate_json(prompt)
            
            # Handle error case
            if "error" in result:
                # Fallback: use keyword matching
                if has_scope_keywords:
                    return RouterOutput(
                        in_scope=True,
                        confidence=0.6,
                        route="answer",
                        reason="Keyword match - LLM unavailable"
                    )
                else:
                    return RouterOutput(
                        in_scope=False,
                        confidence=0.4,
                        route="refuse",
                        reason="No keyword match - LLM unavailable"
                    )
            
            # Parse LLM response
            in_scope = result.get("in_scope", False)
            confidence = result.get("confidence", 0.5)
            route = result.get("route", "refuse")
            reason = result.get("reason", "")
            
            return RouterOutput(
                in_scope=in_scope,
                confidence=confidence,
                route=route,
                reason=reason
            )
            
        except Exception as e:
            print(f"Error in router: {e}")
            # Fallback to keyword matching
            if has_scope_keywords:
                return RouterOutput(
                    in_scope=True,
                    confidence=0.5,
                    route="answer",
                    reason="Fallback keyword match"
                )
            else:
                return RouterOutput(
                    in_scope=False,
                    confidence=0.5,
                    route="refuse",
                    reason="Fallback - no keyword match"
                )


# Global router instance
domain_router = DomainRouter()
