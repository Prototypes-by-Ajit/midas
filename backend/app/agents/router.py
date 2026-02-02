"""Domain router agent for query classification with MIDAS guardrails (FAIL-CLOSED)."""

import re
from app.services.llm_service import llm_service
from app.models.schemas import RouterOutput
from app.utils.prompts import ROUTER_PROMPT, OUT_OF_SCOPE_RESPONSE
from app.config import IN_SCOPE_TOPICS

CLASSIFICATION_IN_SCOPE = "IN_SCOPE_MEDICAL_DERM"
CLASSIFICATION_OUT_OF_SCOPE = "OUT_OF_SCOPE"
CLASSIFICATION_FOLLOWUP = "FOLLOWUP_REFERENTIAL"

CONFIDENCE_THRESHOLD = 0.75


class DomainRouter:
    """
    FAIL-CLOSED router:
    - If query is not clearly dermatology-related, refuse.
    - Only call LLM classification if query is potentially in-scope.
    - LLM failures => refuse (never answer by accident).
    """

    async def route(self, query: str, conversation_context: str = None) -> RouterOutput:
        query = (query or "").strip()
        query_lower = query.lower()

        # ---------------------------------------------------------
        # 0) HARD OUT-OF-SCOPE: identity/person questions
        #    (prevents "who is manoj?" from turning into derm essays)
        # ---------------------------------------------------------
        if self._looks_like_identity_question(query_lower):
            return self._refuse("Identity/person question is out of MIDAS scope.")

        # ---------------------------------------------------------
        # 1) HARD OUT-OF-SCOPE: obvious non-medical domains (tech, etc.)
        # ---------------------------------------------------------
        out_of_scope_keywords = [
            "docker", "kubernetes", "programming", "python", "javascript",
            "react", "nodejs", "database", "sql", "api", "devops", "git",
            "travel", "finance", "stock", "crypto", "recipe", "weather"
        ]
        if any(kw in query_lower for kw in out_of_scope_keywords):
            return self._refuse("Explicit out-of-scope domain keyword detected.")

        # ---------------------------------------------------------
        # 2) Strict referential detection (avoid bare 'that'/'it' triggers)
        # ---------------------------------------------------------
        is_followup = self._is_referential(query_lower)

        # In-scope keyword check
        has_scope_keywords = any(topic in query_lower for topic in IN_SCOPE_TOPICS)

        # ---------------------------------------------------------
        # 3) FAIL-CLOSED FAST PATH:
        #    If it has no in-scope keywords and is not referential -> refuse.
        #    (Do NOT call LLM for random questions.)
        # ---------------------------------------------------------
        if not has_scope_keywords and not is_followup:
            return self._refuse("No dermatology in-scope terminology detected.")

        # ---------------------------------------------------------
        # 4) If referential but no context, ask to clarify (still dermatology-only)
        # ---------------------------------------------------------
        if is_followup and not conversation_context:
            return RouterOutput(
                in_scope=True,  # context resolution is still within MIDAS scope
                confidence=0.5,
                route="clarify",
                reason="Referential followup but no conversation context provided.",
                classification=CLASSIFICATION_FOLLOWUP,
                needs_context_resolution=True
            )

        # ---------------------------------------------------------
        # 5) LLM classification (ONLY for potentially in-scope queries)
        # ---------------------------------------------------------
        prompt = ROUTER_PROMPT.format(query=query)

        try:
            result = await llm_service.generate_json(prompt)

            # FAIL-CLOSED: any error => refuse
            if not isinstance(result, dict) or "error" in result:
                return self._refuse("LLM router failed; fail-closed refusal.")

            classification = result.get("classification", CLASSIFICATION_OUT_OF_SCOPE)
            confidence = float(result.get("confidence", 0.0))
            reason = result.get("reason", "")

            # STRICT refusal
            if classification == CLASSIFICATION_OUT_OF_SCOPE:
                return self._refuse(reason or "Classified out of scope.")

            # FOLLOWUP: require context resolution
            if classification == CLASSIFICATION_FOLLOWUP:
                return RouterOutput(
                    in_scope=True,
                    confidence=confidence,
                    route="clarify" if not conversation_context else "answer",
                    reason=reason or "Followup detected.",
                    classification=CLASSIFICATION_FOLLOWUP,
                    needs_context_resolution=True
                )

            # IN_SCOPE: apply confidence gating
            if confidence >= CONFIDENCE_THRESHOLD:
                return RouterOutput(
                    in_scope=True,
                    confidence=confidence,
                    route="answer",
                    reason=reason or "In-scope with sufficient confidence.",
                    classification=CLASSIFICATION_IN_SCOPE
                )

            return RouterOutput(
                in_scope=True,
                confidence=confidence,
                route="clarify",
                reason=f"Confidence {confidence:.2f} below threshold {CONFIDENCE_THRESHOLD:.2f}. {reason}".strip(),
                classification=CLASSIFICATION_IN_SCOPE
            )

        except Exception:
            # FAIL-CLOSED
            return self._refuse("Router exception; fail-closed refusal.")

    # ---------------- helpers ----------------

    def _refuse(self, reason: str) -> RouterOutput:
        return RouterOutput(
            in_scope=False,
            confidence=1.0,
            route="refuse",
            reason=reason,
            classification=CLASSIFICATION_OUT_OF_SCOPE,
            out_of_scope_response=OUT_OF_SCOPE_RESPONSE
        )

    def get_out_of_scope_response(self) -> str:
        return OUT_OF_SCOPE_RESPONSE

    def _looks_like_identity_question(self, q: str) -> bool:
        """
        Blocks:
        - who is X / who’s X / tell me about X
        - biography/identity style
        """
        patterns = [
            r'^\s*who\s+(is|was|are)\s+\S+',
            r'^\s*who\'?s\s+\S+',
            r'^\s*tell\s+me\s+about\s+\S+',
            r'^\s*what\s+do\s+you\s+know\s+about\s+\S+',
        ]
        return any(re.search(p, q) for p in patterns)

    def _is_referential(self, q: str) -> bool:
        """
        Referential only when there is explicit followup intent.
        No bare 'that/it/this' substring matching.
        """
        patterns = [
            r'^\s*(tell me more|continue|go on|elaborate|explain further)\b',
            r'\b(the above|above|previous|earlier|before|last answer|last message)\b',
            r'^\s*(what|how|why)\s+about\s+(that|this|it)\b',
            r'\bmore about (that|this|it)\b',
        ]
        return any(re.search(p, q) for p in patterns)


# Global router instance
domain_router = DomainRouter()
