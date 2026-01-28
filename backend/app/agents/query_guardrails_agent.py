"""
Query Guardrails Agent - Policy-Based Input Classification

Implements 4-stage guardrails:
A) Query Intent + Domain Classification
B) Scope Resolution (knowledge boundary check)
C) Response Policy Selection
D) Safety Escalation

This fixes the problem where out-of-scope queries receive inappropriate
medical refusals and follow-ups are mis-classified.
"""
from typing import Dict, Any, Optional, List
import re
from enum import Enum


class Domain(str, Enum):
    """Query domain classification."""
    IN_SCOPE_MEDICAL_DERM = "IN_SCOPE_MEDICAL_DERM"  # Skin cancer / dermatology
    OUT_OF_SCOPE = "OUT_OF_SCOPE"    # Anything else
    FOLLOWUP_REFERENTIAL = "FOLLOWUP_REFERENTIAL"  # Referential follow-up


class Intent(str, Enum):
    """Query intent type."""
    ASK_INFO = "ASK_INFO"           # Information request
    FOLLOWUP = "FOLLOWUP"           # Referential follow-up
    DOC_QA = "DOC_QA"              # Document-specific question
    TROUBLESHOOT = "TROUBLESHOOT"   # Technical issue
    SMALLTALK = "SMALLTALK"         # Greeting/chitchat
    OTHER = "OTHER"


class Urgency(str, Enum):
    """Query urgency level."""
    NORMAL = "NORMAL"
    HIGH = "HIGH"      # Emergency symptoms, alarming language


class ResponsePolicy(str, Enum):
    """Response policy to apply."""
    MEDICAL_STRICT = "MEDICAL_STRICT"      # CLARA grounding, 0.75+ confidence
    OUT_OF_SCOPE = "OUT_OF_SCOPE"          # Not in MIDAS domain
    REFERENTIAL_FOLLOWUP = "REFERENTIAL_FOLLOWUP"  # Needs conversation context
    DOCUMENT_QA = "DOCUMENT_QA"            # User-uploaded doc question
    SAFETY_ESCALATION = "SAFETY_ESCALATION"  # Urgent medical situation


# Dermatology/skin cancer keywords
MEDICAL_KEYWORDS = {
    "melanoma", "basal cell", "squamous cell", "bcc", "scc",
    "skin cancer", "lesion", "mole", "nevus", "tumor",
    "carcinoma", "dermatology", "dermoscopy", "biopsy",
    "abcde", "asymmetry", "border", "color", "diameter", "evolving",
    "actinic keratosis", "benign keratosis", "dermatofibroma",
    "vascular", "pigmented", "sunburn", "uv", "sun exposure",
    "treatment", "excision", "mohs", "cryotherapy", "radiation",
    "prognosis", "staging", "metastasis", "lymph nodes"
}

# Referential follow-up patterns
REFERENTIAL_PATTERNS = [
    r"\b(above|the above|that|this|it|those|these)\b",
    r"\b(more about|explain further|continue|elaborate|tell me more)\b",
    r"^(what|how|why|when|where)\s+(about|is|are)\s+(that|this|it|the above)",
]

# Emergency/urgent medical keywords
URGENT_KEYWORDS = {
    "emergency", "urgent", "bleeding", "severe pain",
    "spreading rapidly", "can't breathe", "chest pain",
    "sudden change", "very worried", "need help now"
}

# Document reference patterns
DOC_REFERENCE_PATTERNS = [
    r"\b(ctorw|CtorW|README|LICENSE|\.md|\.txt|\.pdf)\b",
    r"\b(file|document|doc|upload)\s+\w+",
    r"(about|explain|show|read)\s+(the\s+)?(\w+\.(md|txt|pdf))",
]


class QueryGuardrailsAgent:
    """
    Policy-based query classification and response policy selector.
    
    Prevents inappropriate medical refusals for out-of-scope queries.
    """
    
    def __init__(self):
        self.medical_keywords = MEDICAL_KEYWORDS
        self.referential_patterns = [re.compile(p, re.IGNORECASE) for p in REFERENTIAL_PATTERNS]
        self.urgent_keywords = URGENT_KEYWORDS
        self.doc_patterns = [re.compile(p, re.IGNORECASE) for p in DOC_REFERENCE_PATTERNS]
    
    def classify_query(
        self,
        query: str,
        conversation_history: Optional[List[Dict]] = None,
        available_docs: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Stage A: Query Intent + Domain Classification.
        
        Returns guardrails decision object with routing policy.
        """
        query_lower = query.lower()
        
        # Detect referential follow-up
        is_referential = self._is_referential(query)
        
        # Detect urgency
        urgency = self._detect_urgency(query_lower)
        
        # Detect document reference
        doc_reference = self._detect_document_reference(query, available_docs or [])
        
        # Classify domain (STAGE A core)
        domain = self._classify_domain(query_lower, is_referential, doc_reference)
        
        # Classify intent
        intent = self._classify_intent(query_lower, is_referential, doc_reference)
        
        # Scope resolution (STAGE B)
        scope_info = self._resolve_scope(domain, intent, doc_reference)
        
        # Response policy selection (STAGE C)
        response_policy = self._select_response_policy(
            domain, intent, urgency, is_referential, doc_reference
        )
        
        # Build guardrails decision
        decision = {
            # Stage A outputs
            "domain": domain.value,
            "intent": intent.value,
            "referential": is_referential,
            "urgency": urgency.value,
            "requires_tools": False,  # Can extend for web search, etc.
            "confidence_in_classification": self._compute_classification_confidence(
                query_lower, domain, intent
            ),
            
            # Stage B outputs
            "primary_corpus": scope_info["corpus"],
            "in_scope": scope_info["in_scope"],
            "doc_reference": doc_reference,
            
            # Stage C outputs
            "response_policy": response_policy.value,
            "apply_medical_disclaimer": self._should_apply_disclaimer(domain, response_policy),
            "confidence_threshold": self._get_confidence_threshold(response_policy),
            
            # Actionable routing
            "next_action": self._determine_next_action(response_policy, is_referential),
            "user_message_template": self._get_message_template(response_policy),
            
            # Debug metadata
            "medical_keyword_matches": self._count_medical_keywords(query_lower),
            "doc_pattern_matched": bool(doc_reference),
        }
        
        return decision
    
    def _is_referential(self, query: str) -> bool:
        """
        Detect referential follow-up patterns (STRICT).
        
        ONLY return True if query contains explicit referential keywords.
        Do NOT classify short queries as referential unless they have patterns.
        """
        # Must contain actual referential pattern
        return any(pattern.search(query) for pattern in self.referential_patterns)
    
    def _detect_urgency(self, query_lower: str) -> Urgency:
        """Detect urgent/emergency language."""
        for keyword in self.urgent_keywords:
            if keyword in query_lower:
                return Urgency.HIGH
        return Urgency.NORMAL
    
    def _detect_document_reference(
        self, query: str, available_docs: List[str]
    ) -> Optional[str]:
        """
        Detect if query references a specific document.
        
        Returns document name if found, else None.
        """
        # Check patterns first
        for pattern in self.doc_patterns:
            match = pattern.search(query)
            if match:
                # Extract potential doc name
                doc_name = match.group(0)
                return doc_name
        
        # Check against available docs list
        query_lower = query.lower()
        for doc in available_docs:
            if doc.lower() in query_lower:
                return doc
        
        return None
    
    def _classify_domain(
        self, query_lower: str, is_referential: bool, doc_reference: Optional[str]
    ) -> Domain:
        """
        STAGE A: Classify query domain (STRICT 3-class).
        
        Returns:
        - IN_SCOPE_MEDICAL_DERM: dermatology/skin-cancer question
        - OUT_OF_SCOPE: anything else (docker, files, general topics)
        - FOLLOWUP_REFERENTIAL: referential query needing resolution
        """
        # If referential, mark for follow-up resolution
        if is_referential:
            return Domain.FOLLOWUP_REFERENTIAL
        
        # If explicit non-medical doc reference (ctorw, docker, etc.)
        if doc_reference and not self._is_medical_doc(doc_reference):
            return Domain.OUT_OF_SCOPE
        
        # Count medical keywords
        medical_matches = self._count_medical_keywords(query_lower)
        
        # Strong medical signal (2+ keywords) → IN_SCOPE
        if medical_matches >= 2:
            return Domain.IN_SCOPE_MEDICAL_DERM
        
        # No medical keywords → OUT_OF_SCOPE
        if medical_matches == 0:
            return Domain.OUT_OF_SCOPE
        
        # Borderline (1 keyword): check if it's medical context
        # High-value medical terms alone qualify
        strong_medical_terms = ["melanoma", "carcinoma", "biopsy", "dermoscopy"]
        if any(term in query_lower for term in strong_medical_terms):
            return Domain.IN_SCOPE_MEDICAL_DERM
        
        # Weak context (1 generic keyword) → OUT_OF_SCOPE
        return Domain.OUT_OF_SCOPE
    
    def _classify_intent(
        self, query_lower: str, is_referential: bool, doc_reference: Optional[str]
    ) -> Intent:
        """Classify query intent."""
        if is_referential:
            return Intent.FOLLOWUP
        
        if doc_reference:
            return Intent.DOC_QA
        
        # Check for greetings/smalltalk
        greetings = ["hello", "hi", "hey", "thanks", "thank you", "goodbye", "bye"]
        if any(g in query_lower for g in greetings) and len(query_lower.split()) <= 3:
            return Intent.SMALLTALK
        
        # Check for troubleshooting patterns
        troubleshoot_patterns = ["error", "not working", "bug", "issue", "problem", "fix"]
        if any(p in query_lower for p in troubleshoot_patterns):
            return Intent.TROUBLESHOOT
        
        # Default to information request
        return Intent.ASK_INFO
    
    def _resolve_scope(
        self, domain: Domain, intent: Intent, doc_reference: Optional[str]
    ) -> Dict[str, Any]:
        """
        STAGE B: Scope Resolution (STRICT).
        """
        if domain == Domain.IN_SCOPE_MEDICAL_DERM:
            return {
                "corpus": "MEDICAL_CORPUS",
                "in_scope": True,
            }
        
        if domain == Domain.FOLLOWUP_REFERENTIAL:
            return {
                "corpus": "CONVERSATION_MEMORY",
                "in_scope": True,  # Needs resolution first
            }
        
        # OUT_OF_SCOPE
        return {
            "corpus": "NONE",
            "in_scope": False,
        }
    
    def _select_response_policy(
        self,
        domain: Domain,
        intent: Intent,
        urgency: Urgency,
        is_referential: bool,
        doc_reference: Optional[str]
    ) -> ResponsePolicy:
        """
        STAGE C: Response Policy Selection (STRICT 3-class).
        """
        # Safety escalation for urgent medical queries
        if urgency == Urgency.HIGH and domain == Domain.IN_SCOPE_MEDICAL_DERM:
            return ResponsePolicy.SAFETY_ESCALATION
        
        # Referential follow-up
        if domain == Domain.FOLLOWUP_REFERENTIAL:
            return ResponsePolicy.REFERENTIAL_FOLLOWUP
        
        # Medical strict mode (CLARA grounding)
        if domain == Domain.IN_SCOPE_MEDICAL_DERM:
            return ResponsePolicy.MEDICAL_STRICT
        
        # OUT_OF_SCOPE (everything else)
        return ResponsePolicy.OUT_OF_SCOPE
    
    def _should_apply_disclaimer(
        self, domain: Domain, policy: ResponsePolicy
    ) -> bool:
        """
        Medical disclaimer ONLY for IN_SCOPE_MEDICAL_DERM.
        
        NEVER for OUT_OF_SCOPE.
        """
        return (
            domain == Domain.IN_SCOPE_MEDICAL_DERM
            and policy in [ResponsePolicy.MEDICAL_STRICT, ResponsePolicy.SAFETY_ESCALATION]
        )
    
    def _get_confidence_threshold(self, policy: ResponsePolicy) -> float:
        """
        Domain-gated thresholds (STRICT).
        
        CRITICAL: Medical threshold (0.75) applies ONLY to IN_SCOPE_MEDICAL_DERM.
        """
        if policy == ResponsePolicy.MEDICAL_STRICT:
            return 0.75
        elif policy == ResponsePolicy.SAFETY_ESCALATION:
            return 0.80
        elif policy == ResponsePolicy.REFERENTIAL_FOLLOWUP:
            return 0.75  # After resolution, treat as medical
        else:
            return 0.0  # OUT_OF_SCOPE has no threshold
    
    def _determine_next_action(
        self, policy: ResponsePolicy, is_referential: bool
    ) -> str:
        """Determine immediate routing action."""
        if policy == ResponsePolicy.OUT_OF_SCOPE:
            return "STOP"  # Don't retrieve from medical corpus
        
        if policy == ResponsePolicy.REFERENTIAL_FOLLOWUP:
            return "RESOLVE_FOLLOWUP"  # Run follow-up resolver first
        
        if policy == ResponsePolicy.SAFETY_ESCALATION:
            return "ANSWER"  # Provide urgent guidance immediately
        
        return "RETRIEVE"  # Standard retrieval path
    
    def _get_message_template(self, policy: ResponsePolicy) -> str:
        """Select appropriate response template."""
        templates = {
            ResponsePolicy.OUT_OF_SCOPE: "OUT_OF_SCOPE_MIDAS",
            ResponsePolicy.MEDICAL_STRICT: "MEDICAL_GROUNDED",
            ResponsePolicy.REFERENTIAL_FOLLOWUP: "CLARIFY_OR_EXPAND",
            ResponsePolicy.DOCUMENT_QA: "DOC_ANSWER",
            ResponsePolicy.SAFETY_ESCALATION: "URGENT_GUIDANCE",
        }
        return templates.get(policy, "STANDARD")
    
    def _count_medical_keywords(self, query_lower: str) -> int:
        """Count medical keyword matches."""
        return sum(1 for keyword in self.medical_keywords if keyword in query_lower)
    
    def _is_medical_doc(self, doc_name: str) -> bool:
        """Check if document name suggests medical content."""
        medical_doc_keywords = [
            "melanoma", "cancer", "lesion", "biopsy", "treatment",
            "dermat", "skin", "tumor", "carcinoma"
        ]
        doc_lower = doc_name.lower()
        return any(kw in doc_lower for kw in medical_doc_keywords)
    
    def _compute_classification_confidence(
        self, query_lower: str, domain: Domain, intent: Intent
    ) -> float:
        """
        Estimate confidence in the classification itself.
        
        Used for debugging and audit.
        """
        confidence = 0.5  # baseline
        
        # Strong medical keywords boost confidence
        medical_matches = self._count_medical_keywords(query_lower)
        if domain == Domain.IN_SCOPE_MEDICAL_DERM and medical_matches >= 2:
            confidence = min(0.95, 0.70 + (medical_matches * 0.08))
        
        # Explicit doc references for OUT_OF_SCOPE are high confidence
        if domain == Domain.OUT_OF_SCOPE and medical_matches == 0:
            confidence = max(confidence, 0.90)
        
        # Referential follow-ups are medium confidence
        if domain == Domain.FOLLOWUP_REFERENTIAL:
            confidence = 0.70
        
        return round(confidence, 2)
    
    def get_out_of_scope_message(self) -> str:
        """
        MANDATORY OUT_OF_SCOPE template.
        
        STRICT RULE: Return EXACTLY this, no modifications.
        """
        return "Out of scope for MIDAS: I only handle dermatology / skin-cancer topics. Ask me about skin lesions, melanoma/ABCDE signs, biopsy, treatment, or prevention."


# Global instance
query_guardrails_agent = QueryGuardrailsAgent()
