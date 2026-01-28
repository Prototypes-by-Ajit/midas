"""Domain router agent for query classification with MIDAS guardrails."""
from app.services.llm_service import llm_service
from app.models.schemas import RouterOutput
from app.utils.prompts import ROUTER_PROMPT, OUT_OF_SCOPE_RESPONSE
from app.config import IN_SCOPE_TOPICS

# Classification types
CLASSIFICATION_IN_SCOPE = "IN_SCOPE_MEDICAL_DERM"
CLASSIFICATION_OUT_OF_SCOPE = "OUT_OF_SCOPE"
CLASSIFICATION_FOLLOWUP = "FOLLOWUP_REFERENTIAL"

# Confidence threshold for answering medical questions
CONFIDENCE_THRESHOLD = 0.75


class DomainRouter:
    """
    Agent that classifies queries with MIDAS guardrails.

    Classifications:
    - IN_SCOPE_MEDICAL_DERM: Dermatology/skin cancer topics
    - OUT_OF_SCOPE: Non-dermatology topics (strict refusal)
    - FOLLOWUP_REFERENTIAL: References prior conversation
    """

    async def route(self, query: str, conversation_context: str = None) -> RouterOutput:
        """
        Classify query and determine routing with confidence gating.

        Args:
            query: User's question
            conversation_context: Optional prior conversation for followup resolution

        Returns:
            RouterOutput with classification and routing decision
        """
        # Quick keyword check for common out-of-scope patterns
        query_lower = query.lower()

        # Strict OUT_OF_SCOPE detection (programming, tech, etc.)
        out_of_scope_keywords = [
            "docker", "kubernetes", "programming", "python", "javascript",
            "react", "nodejs", "database", "sql", "api", "devops", "git",
            "travel", "finance", "stock", "crypto", "recipe", "weather"
        ]
        if any(kw in query_lower for kw in out_of_scope_keywords):
            return RouterOutput(
                in_scope=False,
                confidence=1.0,
                route="refuse",
                reason=CLASSIFICATION_OUT_OF_SCOPE,
                classification=CLASSIFICATION_OUT_OF_SCOPE
            )

        # Check for followup/referential patterns
        followup_patterns = ["above", "that", "it", "continue", "more about that", "tell me more", "what about"]
        is_followup = any(pattern in query_lower for pattern in followup_patterns) and len(query.split()) < 10

        # In-scope keyword check
        has_scope_keywords = any(topic in query_lower for topic in IN_SCOPE_TOPICS)

        # Use LLM for classification
        prompt = ROUTER_PROMPT.format(query=query)

        try:
            result = await llm_service.generate_json(prompt)

            # Handle error case
            if "error" in result:
                return self._fallback_classification(query, has_scope_keywords, is_followup)

            # Parse LLM response
            classification = result.get("classification", CLASSIFICATION_OUT_OF_SCOPE)
            in_scope = result.get("in_scope", False)
            confidence = result.get("confidence", 0.5)
            route = result.get("route", "refuse")
            reason = result.get("reason", "")
            needs_context = result.get("needs_context_resolution", False)

            # Apply MIDAS guardrails policy
            if classification == CLASSIFICATION_OUT_OF_SCOPE:
                # STRICT: Always refuse out-of-scope with exact template
                return RouterOutput(
                    in_scope=False,
                    confidence=1.0,
                    route="refuse",
                    reason=CLASSIFICATION_OUT_OF_SCOPE,
                    classification=CLASSIFICATION_OUT_OF_SCOPE
                )

            elif classification == CLASSIFICATION_FOLLOWUP:
                # Resolve reference using conversation context
                return RouterOutput(
                    in_scope=True,  # Assume in-scope until resolved
                    confidence=confidence,
                    route="clarify" if not conversation_context else "answer",
                    reason=reason,
                    classification=CLASSIFICATION_FOLLOWUP,
                    needs_context_resolution=True
                )

            else:  # IN_SCOPE_MEDICAL_DERM
                # Apply confidence gating
                if confidence >= CONFIDENCE_THRESHOLD:
                    return RouterOutput(
                        in_scope=True,
                        confidence=confidence,
                        route="answer",
                        reason=reason,
                        classification=CLASSIFICATION_IN_SCOPE
                    )
                else:
                    # Low confidence: ask for clarification
                    return RouterOutput(
                        in_scope=True,
                        confidence=confidence,
                        route="clarify",
                        reason=f"Confidence {confidence:.2f} below threshold {CONFIDENCE_THRESHOLD}",
                        classification=CLASSIFICATION_IN_SCOPE
                    )

        except Exception as e:
            print(f"Error in router: {e}")
            return self._fallback_classification(query, has_scope_keywords, is_followup)

    def _fallback_classification(self, query: str, has_scope_keywords: bool, is_followup: bool) -> RouterOutput:
        """Fallback classification when LLM fails."""
        if is_followup:
            return RouterOutput(
                in_scope=True,
                confidence=0.5,
                route="clarify",
                reason="Followup detected - LLM unavailable",
                classification=CLASSIFICATION_FOLLOWUP,
                needs_context_resolution=True
            )
        elif has_scope_keywords:
            return RouterOutput(
                in_scope=True,
                confidence=0.6,
                route="answer",
                reason="Keyword match - LLM unavailable",
                classification=CLASSIFICATION_IN_SCOPE
            )
        else:
            return RouterOutput(
                in_scope=False,
                confidence=0.8,
                route="refuse",
                reason="No keyword match - LLM unavailable",
                classification=CLASSIFICATION_OUT_OF_SCOPE
            )

    def get_out_of_scope_response(self) -> str:
        """Return the exact OUT_OF_SCOPE response template."""
        return OUT_OF_SCOPE_RESPONSE


# Global router instance
domain_router = DomainRouter()
