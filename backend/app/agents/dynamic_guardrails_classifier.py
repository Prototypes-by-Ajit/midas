"""
Dynamic LLM-based Guardrails Classifier

Uses LLM reasoning to classify queries into domains dynamically,
rather than relying on hardcoded keyword lists.
"""
from typing import Dict, Any, Optional, List
import json
import re
from app.services.llm_service import llm_service
from app.config import settings


class DynamicGuardrailsClassifier:
    """
    MIDAS Domain Classifier with strict guardrails.

    Classification order:
    1. FAST PATH: No in-scope keywords → OUT_OF_SCOPE (immediate)
    2. Referential check → FOLLOWUP_REFERENTIAL (if context exists)
    3. LLM classification (only if potentially in-scope)
    """

    def __init__(self):
        self.llm = llm_service

        # IN-SCOPE keywords for dermatology/skin-cancer domain
        # Query must contain AT LEAST ONE of these to be considered potentially in-scope
        self.in_scope_keywords = [
            # Cancer types
            "melanoma", "carcinoma", "basal cell", "squamous cell", "bcc", "scc",
            # Skin terms
            "skin", "dermato", "epiderm", "lesion", "mole", "nevus", "nevi",
            "pigment", "spot", "growth", "tumor", "malignant", "benign",
            # Clinical terms
            "abcde", "dermoscopy", "dermatoscopy", "biopsy", "pathology",
            "excision", "mohs", "cryotherapy",
            # Symptoms
            "rash", "itching", "bleeding", "asymmetry", "border", "color",
            "diameter", "evolving", "ugly duckling",
            # Treatment/prevention
            "sunburn", "uv", "sunscreen", "radiation", "immunotherapy",
            "staging", "prognosis", "metastasis",
            # General medical dermatology
            "dermatologist", "oncology", "screening", "examination",
        ]

        # MIDAS scope definition (for LLM context)
        self.scope_definition = """
MIDAS is a medical AI assistant focused on DERMATOLOGY and SKIN CANCER education.

IN-SCOPE topics include:
- Skin cancers: melanoma, basal cell carcinoma (BCC), squamous cell carcinoma (SCC)
- Skin lesions: moles, nevi, pigmented lesions, suspicious growths
- Clinical evaluation: ABCDE rule, dermoscopy, skin examination
- Diagnosis: biopsy, pathology, staging
- Treatment: surgical excision, Mohs surgery, cryotherapy, radiation, immunotherapy
- Prevention: sun protection, UV exposure, skin cancer screening
- Symptoms and warning signs
- Risk factors and epidemiology

OUT-OF-SCOPE topics include:
- Other medical specialties (cardiology, neurology, etc.)
- Non-medical topics (software, devops, docker, programming, finance, travel, relationships)
- Files or documents unrelated to dermatology (ctorw.md, README, etc.)
- General knowledge questions
- Anything not directly related to skin cancer or dermatology
"""
    
    def _has_any_inscope_keywords(self, query: str) -> bool:
        """Check if query contains ANY in-scope dermatology keywords."""
        query_lower = query.lower()
        return any(kw in query_lower for kw in self.in_scope_keywords)

    def _has_dermatology_context(self, conversation_history: List[Dict]) -> bool:
        """Check if conversation history contains dermatology context."""
        if not conversation_history:
            return False
        # Check last 6 messages for in-scope keywords
        for msg in conversation_history[-6:]:
            content = (msg.get("content") or "").lower()
            if any(kw in content for kw in self.in_scope_keywords):
                return True
        return False

    async def classify_domain(
        self,
        query: str,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Classify query domain with MIDAS guardrails.

        Classification order:
        1. FAST PATH: No in-scope keywords → OUT_OF_SCOPE (immediate)
        2. Referential check → FOLLOWUP_REFERENTIAL (if derm context exists)
        3. LLM classification (only if potentially in-scope)

        Returns:
        {
            "domain": "IN_SCOPE_MEDICAL_DERM|OUT_OF_SCOPE|FOLLOWUP_REFERENTIAL",
            "reasoning": "explanation of classification",
            "confidence": 0.0-1.0
        }
        """
        # ===== FAST PATH: No in-scope keywords = OUT_OF_SCOPE =====
        has_inscope = self._has_any_inscope_keywords(query)
        is_referential = self._is_referential_fast(query)

        # If no in-scope keywords AND not referential → definitely OUT_OF_SCOPE
        if not has_inscope and not is_referential:
            return {
                "domain": "OUT_OF_SCOPE",
                "reasoning": "Query contains no dermatology or skin cancer related terms",
                "confidence": 1.0
            }

        # ===== REFERENTIAL QUERIES =====
        if is_referential:
            # Check if conversation has dermatology context
            has_derm_context = self._has_dermatology_context(conversation_history)
            if has_derm_context:
                return {
                    "domain": "FOLLOWUP_REFERENTIAL",
                    "reasoning": "Referential query with dermatology context in conversation",
                    "confidence": 0.95
                }
            else:
                # Referential but NO dermatology context = OUT_OF_SCOPE
                return {
                    "domain": "OUT_OF_SCOPE",
                    "reasoning": "Referential query but no dermatology context in conversation",
                    "confidence": 0.90
                }

        # ===== HAS IN-SCOPE KEYWORDS: Use LLM to verify =====
        # Use LLM to classify (only for queries with potential in-scope content)
        classification_prompt = f"""You are a medical domain classifier for MIDAS, a dermatology/skin-cancer assistant.

{self.scope_definition}

TASK: Classify the following user query into ONE of these domains:
1. IN_SCOPE_MEDICAL_DERM - if the query is about skin cancer, dermatology, or related medical topics
2. OUT_OF_SCOPE - if the query is about anything else

User query: "{query}"

Think step-by-step:
1. What is the query asking about?
2. Does it relate to skin cancer, dermatology, or skin conditions?
3. If it mentions files, documents, or technical topics (docker, programming, etc.), is it asking about them in a dermatology context?

Respond in JSON format:
{{
    "domain": "IN_SCOPE_MEDICAL_DERM" or "OUT_OF_SCOPE",
    "reasoning": "brief explanation (1-2 sentences)",
    "confidence": 0.0 to 1.0
}}

JSON response:"""

        try:
            response = await self.llm.generate(
                prompt=classification_prompt,
                temperature=0.1,  # Low temperature for consistent classification
                max_tokens=150
            )
            
            # Extract JSON from response
            json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if json_match:
                classification = json.loads(json_match.group(0))
                
                # Validate response
                if classification.get("domain") in ["IN_SCOPE_MEDICAL_DERM", "OUT_OF_SCOPE"]:
                    return classification
            
            # Fallback if parsing fails
            return self._fallback_classification(query)
            
        except Exception as e:
            print(f"LLM classification error: {e}")
            return self._fallback_classification(query)
    
    def _is_referential_fast(self, query: str) -> bool:
        """
        Fast path for detecting referential queries.
        
        Returns True only if explicit referential patterns found.
        """
        referential_patterns = [
            r'\b(above|the above)\b',
            r'\b(that|this|it)\b.*\b(above|before|earlier|previous)\b',
            r'\bmore about (that|this|it)\b',
            r'\b(tell me more|continue|elaborate|explain further)\b',
            r'^(what|how|why) (about|is|are) (that|this|it|the above)',
        ]
        
        query_lower = query.lower()
        return any(re.search(pattern, query_lower) for pattern in referential_patterns)
    
    def _fallback_classification(self, query: str) -> Dict[str, Any]:
        """
        Fallback classification if LLM fails.

        Uses in_scope_keywords list for consistent behavior.
        """
        # Use the same in-scope keywords as the fast path
        if self._has_any_inscope_keywords(query):
            return {
                "domain": "IN_SCOPE_MEDICAL_DERM",
                "reasoning": "Contains dermatology/medical terminology (fallback)",
                "confidence": 0.75
            }
        else:
            return {
                "domain": "OUT_OF_SCOPE",
                "reasoning": "No dermatology-related content detected (fallback)",
                "confidence": 0.95
            }

    def get_out_of_scope_message(self) -> str:
        """MANDATORY OUT_OF_SCOPE template - use this exact text."""
        return "Out of scope for MIDAS: I can only answer dermatology / skin-cancer questions. Please ask a skin/lesion/cancer-related question."


# Global instance
dynamic_classifier = DynamicGuardrailsClassifier()
