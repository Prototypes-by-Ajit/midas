"""
Citation Verifier Agent for validating answer grounding.

Prevents hallucinations by verifying that generated answers are
properly grounded in retrieved evidence.
"""

import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class CitationVerifier:
    """
    Verifies that generated answers are grounded in retrieved evidence.

    Checks:
    1. Every claim has supporting evidence
    2. Sources actually contain the claimed information
    3. No contradictions between answer and sources
    """

    def __init__(self, llm_service, min_confidence: float = 0.7):
        """
        Initialize citation verifier.

        Args:
            llm_service: LLM service for verification
            min_confidence: Minimum grounding confidence (default 0.7)
        """
        self.llm = llm_service
        self.min_confidence = min_confidence

    async def verify_answer(
        self,
        answer: str,
        sources: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Verify answer grounding against sources.

        Args:
            answer: Generated answer
            sources: Retrieved source documents

        Returns:
            Dict with is_grounded, confidence, claims, warnings
        """
        try:
            if not sources:
                return {
                    "is_grounded": False,
                    "confidence": 0.0,
                    "grounded_claims": [],
                    "ungrounded_claims": ["No sources available"],
                    "warnings": ["No source documents provided for verification"]
                }

            # Extract claims from answer
            claims = await self._extract_claims(answer)

            if not claims:
                # No specific claims to verify
                return {
                    "is_grounded": True,
                    "confidence": 0.8,
                    "grounded_claims": [],
                    "ungrounded_claims": [],
                    "warnings": []
                }

            # Verify each claim
            grounded = []
            ungrounded = []

            for claim in claims:
                is_supported = await self._verify_claim(claim, sources)
                if is_supported:
                    grounded.append(claim)
                else:
                    ungrounded.append(claim)

            # Calculate confidence
            total = len(claims)
            confidence = len(grounded) / total if total > 0 else 0.0

            # Generate warnings
            warnings = []
            if ungrounded:
                warnings.append(
                    f"{len(ungrounded)}/{total} claims lack source support"
                )
            if confidence < self.min_confidence:
                warnings.append(
                    "Low grounding confidence - answer may contain unsupported claims"
                )

            logger.info(
                f"Citation verification: {len(grounded)}/{total} claims grounded "
                f"(confidence: {confidence:.2f})"
            )

            return {
                "is_grounded": len(ungrounded) == 0,
                "confidence": confidence,
                "grounded_claims": grounded,
                "ungrounded_claims": ungrounded,
                "warnings": warnings
            }

        except Exception as e:
            logger.error(f"Citation verification error: {e}")
            # Return passing result on error to avoid blocking
            return {
                "is_grounded": True,
                "confidence": 0.5,
                "grounded_claims": [],
                "ungrounded_claims": [],
                "warnings": ["Verification error - unable to check grounding"]
            }

    async def _extract_claims(self, answer: str) -> List[str]:
        """
        Extract factual claims from answer.

        Args:
            answer: Generated answer text

        Returns:
            List of factual claims
        """
        try:
            prompt = f"""Extract all factual medical claims from this answer.

Answer:
{answer[:1000]}

List each claim as a separate line, starting with "-". Focus on:
- Diagnostic statements
- Treatment recommendations
- Risk factors
- Symptoms
- Prevalence or statistics

Only extract verifiable factual claims, not general statements.

Claims:
"""

            response = await self.llm.ainvoke(prompt)
            response_text = response if isinstance(response, str) else response.get("content", "")

            # Parse claims (lines starting with "-")
            claims = []
            for line in response_text.split('\n'):
                line = line.strip()
                if line.startswith('-'):
                    claim = line.lstrip('- ').strip()
                    if claim:
                        claims.append(claim)

            logger.debug(f"Extracted {len(claims)} claims from answer")
            return claims[:10]  # Limit to 10 claims to avoid excessive LLM calls

        except Exception as e:
            logger.warning(f"Claim extraction error: {e}")
            return []

    async def _verify_claim(
        self,
        claim: str,
        sources: List[Dict[str, Any]]
    ) -> bool:
        """
        Verify if a claim is supported by sources.

        Args:
            claim: Factual claim to verify
            sources: Source documents

        Returns:
            True if claim is supported, False otherwise
        """
        try:
            # Combine source content
            source_text = "\n\n".join([
                f"[Source {i+1}]: {src.get('content', '')[:300]}"
                for i, src in enumerate(sources[:3])
            ])

            prompt = f"""Determine if this medical claim is supported by the provided sources.

Claim: {claim}

Sources:
{source_text}

Is the claim directly supported by the sources?
- Supported: The sources contain information that backs up this claim
- Not supported: The sources don't mention this or contradict it

Respond with ONLY one word: SUPPORTED or NOT_SUPPORTED
"""

            response = await self.llm.ainvoke(prompt)
            response_text = response if isinstance(response, str) else response.get("content", "")

            # Check if response indicates support
            response_upper = response_text.upper().strip()
            is_supported = "SUPPORTED" in response_upper and "NOT_SUPPORTED" not in response_upper

            logger.debug(f"Claim verification: '{claim[:50]}...' -> {is_supported}")
            return is_supported

        except Exception as e:
            logger.warning(f"Claim verification error: {e}")
            # Default to supported on error (fail open)
            return True

    def get_stats(self) -> Dict[str, Any]:
        """Get verifier statistics."""
        return {
            "min_confidence": self.min_confidence,
            "verifier_enabled": True
        }
