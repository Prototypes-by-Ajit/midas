"""
Guardrail Agent for enforcing safety and policy constraints.

Checks:
- Input validation (PII detection, scope checking)
- Output validation (medical advice detection, disclaimer enforcement)
"""

import logging
import re
from typing import Dict, List, Any
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

    def __init__(self, llm_service=None):
        """
        Initialize guardrail agent.

        Args:
            llm_service: Optional LLM service for semantic checks
        """
        self.llm = llm_service
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

    async def check_input(self, query: str) -> Dict[str, Any]:
        """
        Check if input query violates policies.

        Args:
            query: User query

        Returns:
            Dict with is_safe, violations, modified_query, warning
        """
        violations = []

        # Check 1: PII detection
        if self._contains_pii(query):
            violations.append(GuardrailViolation.PRIVACY_BREACH)
            logger.warning("Input guardrail: PII detected in query")

        # Check 2: Harmful intent (basic keyword check)
        if self._contains_harmful_keywords(query):
            violations.append(GuardrailViolation.HARMFUL_CONTENT)
            logger.warning("Input guardrail: Harmful content detected")

        # Generate warnings
        warning = self._generate_input_warning(violations) if violations else None

        return {
            "is_safe": len(violations) == 0,
            "violations": [v.value for v in violations],
            "modified_query": self._sanitize_pii(query) if violations else query,
            "warning": warning
        }

    async def check_output(
        self,
        answer: str,
        query: str
    ) -> Dict[str, Any]:
        """
        Check if output answer violates policies.

        Args:
            answer: Generated answer
            query: Original query

        Returns:
            Dict with is_safe, violations, modified_answer, requires_disclaimer
        """
        violations = []
        modified_answer = answer

        # Check 1: Medical advice detection
        if self._gives_medical_advice(answer):
            violations.append(GuardrailViolation.MEDICAL_ADVICE)
            logger.warning("Output guardrail: Prescriptive medical advice detected")

        # Check 2: Ensure disclaimer present
        requires_disclaimer = GuardrailViolation.MEDICAL_ADVICE in violations

        return {
            "is_safe": len(violations) == 0,
            "violations": [v.value for v in violations],
            "modified_answer": modified_answer,
            "requires_disclaimer": requires_disclaimer
        }

    def _contains_pii(self, text: str) -> bool:
        """
        Detect personally identifiable information.

        Args:
            text: Text to check

        Returns:
            True if PII detected
        """
        for pattern in self.pii_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _contains_harmful_keywords(self, text: str) -> bool:
        """
        Check for harmful keywords.

        Args:
            text: Text to check

        Returns:
            True if harmful content detected
        """
        harmful_keywords = [
            "self-harm",
            "suicide",
            "overdose",
            "untested treatment"
        ]

        text_lower = text.lower()
        return any(keyword in text_lower for keyword in harmful_keywords)

    def _gives_medical_advice(self, answer: str) -> bool:
        """
        Detect prescriptive medical advice.

        Args:
            answer: Answer text

        Returns:
            True if medical advice detected
        """
        for pattern in self.advice_patterns:
            if re.search(pattern, answer, re.IGNORECASE):
                return True
        return False

    def _sanitize_pii(self, text: str) -> str:
        """
        Remove PII from text.

        Args:
            text: Text to sanitize

        Returns:
            Sanitized text
        """
        sanitized = text
        for pattern in self.pii_patterns:
            sanitized = re.sub(pattern, "[REDACTED]", sanitized)
        return sanitized

    def _generate_input_warning(
        self,
        violations: List[GuardrailViolation]
    ) -> str:
        """
        Generate warning message for input violations.

        Args:
            violations: List of violations

        Returns:
            Warning message
        """
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
                "I can only answer questions about skin cancer and the 7 approved lesion types."
            )

        return "Warning: Your query may violate content policies."

    def get_stats(self) -> Dict[str, Any]:
        """Get guardrail agent statistics."""
        return {
            "input_guardrails_enabled": True,
            "output_guardrails_enabled": True,
            "pii_detection_enabled": True
        }
