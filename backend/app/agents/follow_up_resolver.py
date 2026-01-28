"""
Follow-up Resolver

Detects referential/underspecified follow‑ups (e.g., "above", "that", "it", "more about this")
Resolves them to an explicit rewritten query using recent conversation state.
Returns a structured object suitable for the orchestrator.
"""
from typing import Dict, Any, List, Optional
import re

REFERENTIAL_PATTERNS = [
    r"\b(above|the above|that|this|it|those|these)\b",
    r"\b(more about|explain further|continue|elaborate|tell me more)\b",
]

INTENT_MAP = {
    "treat": "treatment_options",
    "therapy": "treatment_options",
    "manage": "management",
    "risk": "risk_factors",
    "cause": "causes",
    "etiology": "causes",
    "symptom": "symptoms",
    "sign": "warning_signs",
    "prognosis": "prognosis",
    "diagnos": "diagnosis",
    "screen": "screening",
    "compare": "compare",
    "difference": "compare",
    "prevention": "prevention",
}

TOPIC_REGEX = re.compile(
    r"\b(Melanoma|Basal Cell|Squamous Cell|BCC|SCC|Actinic Keratosis|Nevus|Lesion|Tumor|Carcinoma|Dermatology|Skin Cancer)\b",
    re.IGNORECASE,
)

class FollowUpResolver:
    def is_referential(self, query: str) -> bool:
        q = query.lower()
        if len(q.split()) <= 4:  # short queries are often referential
            return True
        return any(re.search(p, q) for p in REFERENTIAL_PATTERNS)

    def infer_intent(self, query: str) -> str:
        q = query.lower()
        for key, intent in INTENT_MAP.items():
            if key in q:
                return intent
        # default
        return "expand_explanation"

    def extract_topic_from_history(self, conversation_history: Optional[List[Dict]]) -> Optional[Dict[str, Any]]:
        if not conversation_history:
            return None
        # search from last to first for assistant message containing medical topic
        for msg in reversed(conversation_history):
            content = (msg.get("content") or "")
            role = msg.get("role")
            if role != "assistant":
                continue
            match = TOPIC_REGEX.search(content)
            if match:
                return {
                    "topic": match.group(0),
                    "turn_id": msg.get("id") or msg.get("created_at")
                }
        # fallback: pick last assistant content as topic phrase
        for msg in reversed(conversation_history):
            if msg.get("role") == "assistant" and msg.get("content"):
                return {"topic": msg["content"][:40], "turn_id": msg.get("id") or msg.get("created_at")}
        return None

    def build_rewritten_query(self, topic: str, intent: str, original: str) -> str:
        t = topic.strip()
        if intent == "treatment_options":
            return f"What are the treatment options for {t}? Include first‑line therapies and when to refer."
        if intent == "risk_factors":
            return f"What are the key risk factors for {t}? Include patient counseling points."
        if intent == "warning_signs":
            return f"Explain the warning signs for {t} (e.g., ABCDE) with examples and thresholds to seek care."
        if intent == "compare":
            return f"Compare benign vs malignant features for {t}. Provide clinical and dermoscopic differences."
        if intent == "management":
            return f"How is {t} managed in primary care vs dermatology? Include follow‑up intervals."
        if intent == "diagnosis":
            return f"How is {t} diagnosed? Include typical work‑up and when biopsy is indicated."
        if intent == "screening":
            return f"How do we screen for {t}? Include recommended methods and intervals."
        if intent == "prognosis":
            return f"What is the prognosis for {t}? Include staging impact on outcomes."
        if intent == "prevention":
            return f"How can {t} be prevented? Include lifestyle and clinical prevention guidance."
        # default expand
        return f"Explain in more detail about {t}. Summarize key facts, risks, and what to do next."

    def resolve(self, query: str, conversation_history: Optional[List[Dict]]) -> Dict[str, Any]:
        is_ref = self.is_referential(query)
        intent = self.infer_intent(query)
        topic_info = self.extract_topic_from_history(conversation_history) if is_ref else None

        result: Dict[str, Any] = {
            "followup_type": "REFERENTIAL" if is_ref else "DIRECT",
            "intent": intent,
            "ambiguous": False,
            "rewritten_query": query,
            "target_turn_ids": [],
            "topic": []
        }

        if not is_ref:
            return result

        if not topic_info:
            result["ambiguous"] = True
            result["rewritten_query"] = query  # unchanged
            return result

        topic = topic_info["topic"]
        result["target_turn_ids"] = [topic_info["turn_id"]]
        result["topic"] = [topic]
        result["rewritten_query"] = self.build_rewritten_query(topic, intent, query)
        return result

# Global instance
follow_up_resolver = FollowUpResolver()
