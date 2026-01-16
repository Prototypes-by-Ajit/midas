"""
Evidence Grading Agent for evaluating retrieved document relevance and quality.

Grades evidence based on:
1. Relevance to query
2. Quality of source
3. Medical specificity
"""

import logging
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class EvidenceGrade(Enum):
    """Evidence quality grades."""
    HIGHLY_RELEVANT = "highly_relevant"
    RELEVANT = "relevant"
    PARTIALLY_RELEVANT = "partially_relevant"
    NOT_RELEVANT = "not_relevant"


class EvidenceGrader:
    """
    Grades retrieved evidence for relevance and quality.

    For medical RAG, prioritizes:
    - Clinical guidelines > research papers > general articles
    - Specific lesion information > general skin info
    - Direct answers > tangential content
    """

    def __init__(self, llm_service, min_score: float = 0.3):
        """
        Initialize evidence grader.

        Args:
            llm_service: LLM service for grading
            min_score: Minimum relevance score (default 0.3)
        """
        self.llm = llm_service
        self.min_score = min_score

    async def grade_document(
        self,
        query: str,
        document: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Grade a single document for relevance and quality.

        Args:
            query: User query
            document: Document dict with 'content' field

        Returns:
            Dict with grade, relevance_score, quality_score, reasoning
        """
        try:
            content = document.get("content", "")[:500]  # First 500 chars
            source = document.get("source", "Unknown")

            prompt = f"""You are a medical evidence grader for a skin cancer education system.

Grade the relevance of this document to the query on a scale of 0.0-1.0.

Query: {query}

Document excerpt:
{content}...

Source: {source}

Criteria:
1. RELEVANCE: Does this directly address the query? (0.0-1.0)
2. QUALITY: Is this from a reliable medical source? (0.0-1.0)
3. SPECIFICITY: Does it provide specific, actionable information about the 7 approved lesion types? (0.0-1.0)

Respond ONLY in this format:
RELEVANCE_SCORE: [0.0-1.0]
QUALITY_SCORE: [0.0-1.0]
SPECIFICITY_SCORE: [0.0-1.0]
REASONING: [1-2 sentence explanation]
"""

            response = await self.llm.ainvoke(prompt)
            response_text = response if isinstance(response, str) else response.get("content", "")

            # Parse grading response
            parsed = self._parse_grading_response(response_text)

            # Compute overall score
            relevance = parsed.get("relevance_score", 0.5)
            quality = parsed.get("quality_score", 0.5)
            specificity = parsed.get("specificity_score", 0.5)

            overall_score = (relevance * 0.5) + (quality * 0.3) + (specificity * 0.2)

            # Assign grade
            if overall_score >= 0.8:
                grade = EvidenceGrade.HIGHLY_RELEVANT
            elif overall_score >= 0.6:
                grade = EvidenceGrade.RELEVANT
            elif overall_score >= 0.4:
                grade = EvidenceGrade.PARTIALLY_RELEVANT
            else:
                grade = EvidenceGrade.NOT_RELEVANT

            return {
                "grade": grade,
                "relevance_score": relevance,
                "quality_score": quality,
                "specificity_score": specificity,
                "overall_score": overall_score,
                "reasoning": parsed.get("reasoning", "No reasoning provided"),
                "passed": overall_score >= self.min_score
            }

        except Exception as e:
            logger.error(f"Evidence grading error: {e}")
            # Return default passing grade on error
            return {
                "grade": EvidenceGrade.RELEVANT,
                "relevance_score": 0.5,
                "quality_score": 0.5,
                "specificity_score": 0.5,
                "overall_score": 0.5,
                "reasoning": "Grading error - default score applied",
                "passed": True
            }

    async def grade_documents(
        self,
        query: str,
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Grade multiple documents and filter by minimum score.

        Args:
            query: User query
            documents: List of document dicts

        Returns:
            List of graded documents sorted by score (only passing documents)
        """
        if not documents:
            return []

        graded = []

        for doc in documents:
            grade_result = await self.grade_document(query, doc)

            # Only include if passed threshold
            if grade_result["passed"]:
                graded.append({
                    **doc,  # Original document fields
                    "evidence_grade": grade_result["grade"].value,
                    "evidence_relevance": grade_result["relevance_score"],
                    "evidence_quality": grade_result["quality_score"],
                    "evidence_overall": grade_result["overall_score"],
                    "grading_reasoning": grade_result["reasoning"]
                })

        # Sort by overall score (descending)
        graded.sort(key=lambda x: x.get("evidence_overall", 0), reverse=True)

        logger.info(
            f"Evidence grading: {len(graded)}/{len(documents)} documents passed "
            f"(min score: {self.min_score})"
        )

        return graded

    def _parse_grading_response(self, response: str) -> Dict[str, Any]:
        """
        Parse LLM grading response.

        Args:
            response: LLM response text

        Returns:
            Dict with scores and reasoning
        """
        result = {
            "relevance_score": 0.5,
            "quality_score": 0.5,
            "specificity_score": 0.5,
            "reasoning": ""
        }

        try:
            lines = response.strip().split('\n')

            for line in lines:
                line = line.strip()

                if line.startswith('RELEVANCE_SCORE:'):
                    score_str = line.split(':', 1)[1].strip()
                    result['relevance_score'] = float(score_str)

                elif line.startswith('QUALITY_SCORE:'):
                    score_str = line.split(':', 1)[1].strip()
                    result['quality_score'] = float(score_str)

                elif line.startswith('SPECIFICITY_SCORE:'):
                    score_str = line.split(':', 1)[1].strip()
                    result['specificity_score'] = float(score_str)

                elif line.startswith('REASONING:'):
                    reasoning = line.split(':', 1)[1].strip()
                    result['reasoning'] = reasoning

        except Exception as e:
            logger.warning(f"Failed to parse grading response: {e}")

        return result

    def get_stats(self) -> Dict[str, Any]:
        """Get grader statistics."""
        return {
            "min_score": self.min_score,
            "grader_enabled": True
        }
