"""
Guardrail Agent for enforcing safety and policy constraints.

Checks:
- Input validation (PII detection, scope checking)
- Output validation (medical advice detection, disclaimer enforcement)
"""

import logging
import re
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class GuardrailViolation(Enum):
    """Types of guardrail violations."""
    MEDICAL_ADVICE = "medical_advice"      # Prescriptive medical advice
    HARMFUL_CONTENT = "harmful_content"    # Harmful or dangerous content
    PRIVACY_BREACH = "privacy_breach"      # PII detected
    OUT_OF_SCOPE = "out_of_scope"          # Non-dermatology query
    MISINFORMATION = "misinformation"      # Potentially false information


class GuardrailAgent:
    """
    Enforces safety policies on inputs and outputs.

    Two-stage checking:
    1. Input guardrails: Validate queries before processing
    2. Output guardrails: Validate answers before returning
    """

    def __init__(self, llm_service=None, domain_classifier=None):
        """
        Args:
            llm_service: Optional LLM service for semantic checks
            domain_classifier: Your DynamicGuardrailsClassifier (REQUIRED for scope enforcement)
        """
        self.llm = llm_service
        self.domain_classifier = domain_classifier
        self._init_patterns()

    def _init_patterns(self):
        """Initialize regex patterns for detection."""
        # PII patterns
        self.pii_patterns = [
            r'\b\d{3}[- ]?\d{2}[- ]?\d{4}\b',  # SSN
            r'\b\d{10}\b',                      # Phone (10 digits)
            r'\b\d{3}[- ]?\d{3}[- ]?\d{4}\b',  # Phone (formatted)
            r'\b[A-Z]{2}\d{6,8}\b',             # Medical record numbers
        ]

        # Medical advice patterns (prescriptive language)
        self.advice_patterns = [
            r'\byou should take\b',
            r'\bi recommend you take\b',
            r'\byou must take\b',
            r'\byou need to take\b',
            r'\bprescription for\b',
            r'\btake \d+ (mg|tablets|pills)\b',
        ]

    def out_of_scope_message(self) -> str:
        # Keep this EXACT if you want deterministic behavior
        return (
            "Out of scope for MIDAS: I can only answer dermatology / skin-cancer questions. "
            "Please ask a skin/lesion/cancer-related question."
        )

    async def check_input(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        min_domain_confidence: float = 0.75,
    ) -> Dict[str, Any]:
        """
        Returns:
            {
              "is_safe": bool,
              "violations": [...],
              "modified_query": str,
              "warning": str | None,
              "block_response": str | None,          <-- NEW: if set, RETURN THIS IMMEDIATELY
              "domain_decision": {...} | None        <-- NEW: classifier output for logging/debug
            }
        """
        violations: List[GuardrailViolation] = []
        modified_query = query

        # 1) PII detection
        if self._contains_pii(query):
            violations.append(GuardrailViolation.PRIVACY_BREACH)
            logger.warning("Input guardrail: PII detected in query")
            modified_query = self._sanitize_pii(modified_query)

        # 2) Harmful intent
        if self._contains_harmful_keywords(query):
            violations.append(GuardrailViolation.HARMFUL_CONTENT)
            logger.warning("Input guardrail: Harmful content detected")

        # 3) OUT-OF-SCOPE enforcement (CRITICAL)
        domain_decision = None
        if self.domain_classifier is not None:
            domain_decision = await self.domain_classifier.classify_domain(
                query=modified_query,
                conversation_history=conversation_history,
            )
            domain = domain_decision.get("domain", "OUT_OF_SCOPE")
            conf = float(domain_decision.get("confidence", 0.0))

            # Hard-block anything not strictly in-scope
            if domain != "IN_SCOPE_MEDICAL_DERM" or conf < min_domain_confidence:
                violations.append(GuardrailViolation.OUT_OF_SCOPE)
                logger.info(f"Input guardrail: OUT_OF_SCOPE blocked. domain={domain}, conf={conf:.2f}")

                warning = self._generate_input_warning(violations)
                return {
                    "is_safe": False,
                    "violations": [v.value for v in violations],
                    "modified_query": modified_query,
                    "warning": warning,
                    "block_response": self.out_of_scope_message(),   # <-- THIS is what you return to user
                    "domain_decision": domain_decision,
                }

        # If we got here, we are allowed to proceed.
        warning = self._generate_input_warning(violations) if violations else None

        return {
            "is_safe": len(violations) == 0,
            "violations": [v.value for v in violations],
            "modified_query": modified_query,
            "warning": warning,
            "block_response": None,
            "domain_decision": domain_decision,
        }

    async def check_output(
        self,
        answer: str,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Output guardrails:
        - Detect prescriptive medical advice
        - (OPTIONAL but recommended) Re-check domain and override if out-of-scope slipped through

        Returns:
            {
              "is_safe": bool,
              "violations": [...],
              "modified_answer": str,
              "requires_disclaimer": bool,
              "override_answer": str | None,        <-- NEW
              "domain_decision": {...} | None       <-- NEW
            }
        """
        violations: List[GuardrailViolation] = []
        modified_answer = answer

        # (A) Fail-safe domain override (recommended)
        domain_decision = None
        if self.domain_classifier is not None:
            domain_decision = await self.domain_classifier.classify_domain(
                query=query,
                conversation_history=conversation_history,
            )
            domain = domain_decision.get("domain", "OUT_OF_SCOPE")
            if domain != "IN_SCOPE_MEDICAL_DERM":
                violations.append(GuardrailViolation.OUT_OF_SCOPE)
                logger.warning("Output guardrail: overriding leaked out-of-scope answer")
                return {
                    "is_safe": False,
                    "violations": [v.value for v in violations],
                    "modified_answer": modified_answer,
                    "requires_disclaimer": False,
                    "override_answer": self.out_of_scope_message(),
                    "domain_decision": domain_decision,
                }

        # (B) Prescriptive medical advice detection
        if self._gives_medical_advice(answer):
            violations.append(GuardrailViolation.MEDICAL_ADVICE)
            logger.warning("Output guardrail: Prescriptive medical advice detected")

        requires_disclaimer = GuardrailViolation.MEDICAL_ADVICE in violations

        return {
            "is_safe": len(violations) == 0,
            "violations": [v.value for v in violations],
            "modified_answer": modified_answer,
            "requires_disclaimer": requires_disclaimer,
            "override_answer": None,
            "domain_decision": domain_decision,
        }

    # ---------------- existing helpers ----------------

    def _contains_pii(self, text: str) -> bool:
        for pattern in self.pii_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _contains_harmful_keywords(self, text: str) -> bool:
        harmful_keywords = ["self-harm", "suicide", "overdose", "untested treatment"]
        tl = text.lower()
        return any(k in tl for k in harmful_keywords)

    def _gives_medical_advice(self, answer: str) -> bool:
        for pattern in self.advice_patterns:
            if re.search(pattern, answer, re.IGNORECASE):
                return True
        return False

    def _sanitize_pii(self, text: str) -> str:
        sanitized = text
        for pattern in self.pii_patterns:
            sanitized = re.sub(pattern, "[REDACTED]", sanitized)
        return sanitized

    def _generate_input_warning(self, violations: List[GuardrailViolation]) -> str:
        if GuardrailViolation.PRIVACY_BREACH in violations:
            return (
                "Warning: Your query contains personal information. "
                "Please avoid sharing sensitive personal data."
            )
        if GuardrailViolation.HARMFUL_CONTENT in violations:
            return (
                "Warning: Your query contains potentially harmful content. "
                "If you're experiencing a medical emergency, please contact a healthcare professional immediately."
            )
        if GuardrailViolation.OUT_OF_SCOPE in violations:
            return (
                "Warning: This question appears to be outside the scope of dermatology. "
                "I can only answer questions about skin cancer and the approved lesion types."
            )
        return "Warning: Your query may violate content policies."

    def get_stats(self) -> Dict[str, Any]:
        return {
            "input_guardrails_enabled": True,
            "output_guardrails_enabled": True,
            "pii_detection_enabled": True,
            "scope_guardrails_enabled": self.domain_classifier is not None,
        }
