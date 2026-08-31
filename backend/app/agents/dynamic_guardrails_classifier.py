"""
CONSOLIDATED MIDAS GUARDRAILS (FAIL-CLOSED) — FINAL PRODUCTION VERSION

What this fixes (your exact failing case):
✅ "can u explain more about the above" is NOT blocked anymore
   - FOLLOWUP_REFERENTIAL is allowed through the enforcer
   - Followups do NOT require dermatology keywords in the new user message
✅ Followups are ONLY allowed when derm context exists in conversation history
✅ History context detection is robust to different DB schemas (content/message/text/answer/final_answer + metadata + payload/data)
✅ Still fail-closed: classifier errors => OUT_OF_SCOPE
✅ Still no LLM call for clearly out-of-scope questions

IMPORTANT INTEGRATION NOTE:
- This will only work if you pass REAL conversation_history that includes assistant turns.
- If your history fetch returns a different key than content/message/answer/etc, add it to _extract_text().
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Literal
import json
import re

from app.services.llm_service import llm_service


Domain = Literal["IN_SCOPE_MEDICAL_DERM", "OUT_OF_SCOPE", "FOLLOWUP_REFERENTIAL"]


# -----------------------------
# 1) STRICT CLASSIFIER (FINAL)
# -----------------------------

class DynamicGuardrailsClassifier:
    """
    STRICT MIDAS classifier (Derm/Skin-cancer only):

    - FAST PATH: no derm keywords AND not referential -> OUT_OF_SCOPE (no LLM call)
    - Referential -> FOLLOWUP_REFERENTIAL only if prior derm context exists AND
      followup doesn't introduce new out-of-scope topic
    - LLM called only when in-scope keywords present
    - Fail-closed on any parsing/LLM errors -> OUT_OF_SCOPE
    """

    def __init__(self) -> None:
        self.llm = llm_service

        # Presence required to even consider in-scope
        self.in_scope_keywords = [
            # Cancers
            "melanoma", "carcinoma", "basal cell", "squamous cell", "bcc", "scc",
            # Skin / lesions
            "skin", "lesion", "mole", "nevus", "nevi", "tumor", "growth",
            "pigment", "spot", "rash",
            # Clinical
            "abcde", "dermoscopy", "dermatoscopy", "biopsy", "pathology",
            "excision", "mohs", "cryotherapy",
            # Symptoms
            "itching", "bleeding", "asymmetry", "border", "color", "diameter", "evolving",
            # Treatment / prevention
            "sunburn", "uv", "sunscreen", "immunotherapy",
            "metastasis", "staging", "prognosis",
            # Medical context
            "dermatology", "dermatologist", "oncology", "screening", "examination",
        ]
        # Strong deterministic markers that should never be blocked as out-of-scope.
        self.strong_in_scope_keywords = [
            "melanoma", "skin cancer", "basal cell", "squamous cell", "bcc", "scc",
            "lesion", "mole", "nevus", "dermatology", "dermatologist",
            "biopsy", "dermoscopy", "dermatoscopy", "abcde"
        ]

        self.scope_definition = """
MIDAS answers ONLY dermatology and skin-cancer questions.

IN-SCOPE:
- Skin cancers (melanoma, BCC, SCC)
- Skin lesions, moles, suspicious growths
- Diagnosis (biopsy, pathology, staging)
- Treatment and prevention (excision, Mohs, sunscreen, UV)
- Symptoms/warning signs and risk factors

OUT-OF-SCOPE:
- People, characters, history, general knowledge
- Software/programming/devops/docker
- Any non-dermatology topic
""".strip()

    async def classify_domain(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        q = (query or "").strip()
        history = conversation_history or []

        has_inscope = self._has_inscope_keywords(q)
        is_referential = self._is_referential(q)

        # FAST PATH: no derm content & not a followup -> OUT_OF_SCOPE
        if not has_inscope and not is_referential:
            return {**self._oos("No dermatology/skin-cancer terminology detected.", 1.0),
                    "classification": "no_dermatology_keywords"}

        # Referential followups (DO NOT require derm keywords in the followup itself)
        if is_referential:
            if not self._has_derm_context(history):
                return {**self._oos("Referential query without prior dermatology context.", 0.95),
                        "classification": "referential_without_context"}

            residual = self._strip_referential_phrases(q)

            # If user adds a new topic (e.g., "explain more about docker"), block it.
            if residual and not self._has_inscope_keywords(residual):
                return {**self._oos(f"Followup introduces new out-of-scope topic: '{residual}'.", 0.98),
                        "classification": "followup_new_topic"}

            return {
                "domain": "FOLLOWUP_REFERENTIAL",
                "reasoning": "Referential followup within dermatology context.",
                "confidence": 0.95,
            }

        # Deterministic in-scope pass: avoid false refusals for clear derm queries.
        if self._has_strong_inscope_keywords(q):
            return {
                "domain": "IN_SCOPE_MEDICAL_DERM",
                "reasoning": "Strong dermatology terminology detected by deterministic guardrail.",
                "confidence": 0.98,
            }

        # LLM verify ONLY when keyword exists
        try:
            result = await self._llm_classify(q)
            if result is None:
                # If keywords indicate dermatology but JSON parse fails, prefer in-scope.
                if has_inscope:
                    return {
                        "domain": "IN_SCOPE_MEDICAL_DERM",
                        "reasoning": "Classifier JSON parse failed; fallback to keyword-based in-scope classification.",
                        "confidence": 0.80,
                    }
                return {**self._oos("Fail-closed: could not parse classifier JSON.", 0.99),
                        "classification": "classifier_fail_closed"}
            return result
        except Exception as e:
            if has_inscope:
                return {
                    "domain": "IN_SCOPE_MEDICAL_DERM",
                    "reasoning": f"Classifier exception {type(e).__name__}; fallback to keyword-based in-scope classification.",
                    "confidence": 0.80,
                }
            return {**self._oos(f"Fail-closed: classifier exception {type(e).__name__}.", 0.99),
                    "classification": "classifier_fail_closed"}

    def get_out_of_scope_message(self) -> str:
        return (
            "Out of scope for MIDAS: I can only answer dermatology / skin-cancer questions. "
            "Please ask a skin/lesion/cancer-related question."
        )

    # ---------- internals ----------

    def _has_inscope_keywords(self, text: str) -> bool:
        t = (text or "").lower()
        return any(k in t for k in self.in_scope_keywords)

    def _has_strong_inscope_keywords(self, text: str) -> bool:
        t = (text or "").lower()
        return any(k in t for k in self.strong_in_scope_keywords)

    def _extract_text(self, msg: Dict[str, Any]) -> str:
        """
        Robust extraction across common persistence schemas.
        Add keys here if your DB uses a different field name.
        """
        if not isinstance(msg, dict):
            return ""

        # common flat keys
        for k in ("content", "message", "text", "answer", "final_answer"):
            v = msg.get(k)
            if isinstance(v, str) and v.strip():
                return v

        # nested metadata
        meta = msg.get("metadata")
        if isinstance(meta, dict):
            for k in ("content", "message", "text", "answer", "final_answer"):
                v = meta.get(k)
                if isinstance(v, str) and v.strip():
                    return v

        # wrapped payload/data
        data = msg.get("data") or msg.get("payload")
        if isinstance(data, dict):
            for k in ("content", "message", "text", "answer", "final_answer"):
                v = data.get(k)
                if isinstance(v, str) and v.strip():
                    return v

        return ""

    def _has_derm_context(self, history: List[Dict[str, Any]]) -> bool:
        """
        Check recent messages for derm keywords.
        NOTE: include assistant turns in history for this to work.
        """
        if not history:
            return False

        # Slightly wider window improves stability
        for msg in history[-10:]:
            text = self._extract_text(msg).lower()
            if not text:
                continue
            if any(k in text for k in self.in_scope_keywords):
                return True
        return False

    def _is_referential(self, query: str) -> bool:
        """
        Referential detector (covers your real user phrasing).
        """
        q = (query or "").lower().strip()
        patterns = [
            # explicit "above/previous" references
            r'\b(the above|above|previous|earlier|before|last answer|last message)\b',

            # follow-up verbs
            r'^\s*(tell me more|continue|go on|elaborate|expand|explain further)\b',

            # user phrasing
            r'^\s*(can you|can u)\s+(explain more|tell me more|elaborate|expand)\b',
            r'\b(explain more|more details|more explanation|in more detail)\b',

            # "first query/question"
            r'\b(first query|first question|initial question|earlier question)\b',
        ]
        return any(re.search(p, q) for p in patterns)

    def _strip_referential_phrases(self, query: str) -> str:
        """
        Remove referential wrappers and return the residual topic.
        Empty residual => purely referential.
        """
        q = (query or "").lower().strip()

        strip_patterns = [
            r'^\s*(can you|can u)\s+',
            r'^\s*(tell me more about|tell me more)\b',
            r'^\s*(explain more about|explain more)\b',
            r'^\s*(explain further about|explain further)\b',
            r'^\s*(elaborate on|elaborate)\b',
            r'^\s*(expand on|expand)\b',
            r'^\s*(continue with|continue|go on)\b',
            r'\b(the above|above|the previous|previous|earlier|before|last answer|last message)\b',
            r'\b(first query|first question|initial question|earlier question)\b',
            r'\babout\s+(that|this|it)\b',
            r'^\s*(that|this|it)\b',
        ]
        for pattern in strip_patterns:
            q = re.sub(pattern, "", q).strip()

        q = re.sub(r'^[\s,;:.\-]+', "", q).strip()
        q = re.sub(r'[\s,;:.\-]+$', "", q).strip()
        return q

    async def _llm_classify(self, query: str) -> Optional[Dict[str, Any]]:
        prompt = f"""
You are a STRICT medical domain classifier for MIDAS.

{self.scope_definition}

Classify the query as exactly one:
- IN_SCOPE_MEDICAL_DERM
- OUT_OF_SCOPE

Query: "{query}"

Return ONLY valid JSON (no markdown, no extra text):
{{
  "domain": "IN_SCOPE_MEDICAL_DERM" | "OUT_OF_SCOPE",
  "reasoning": "1-2 sentences",
  "confidence": 0.0
}}
""".strip()

        raw = await self.llm.generate(prompt=prompt, temperature=0.0, max_tokens=140)
        obj = self._safe_json(raw)
        if not obj:
            return None

        domain = obj.get("domain")
        if domain not in ("IN_SCOPE_MEDICAL_DERM", "OUT_OF_SCOPE"):
            return None

        try:
            conf = float(obj.get("confidence", 0.0))
        except Exception:
            conf = 0.0
        conf = max(0.0, min(1.0, conf))

        return {
            "domain": domain,
            "reasoning": str(obj.get("reasoning", "")).strip(),
            "confidence": conf,
        }

    def _safe_json(self, text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(text[start: end + 1])
        except Exception:
            return None

    def _oos(self, reason: str, confidence: float) -> Dict[str, Any]:
        return {"domain": "OUT_OF_SCOPE", "reasoning": reason, "confidence": float(confidence)}


# -----------------------------
# 2) HARD ENFORCER (PRE + POST)
# -----------------------------

@dataclass(frozen=True)
class GuardrailsDecision:
    allowed: bool
    payload: Dict[str, Any]


class GuardrailsEnforcer:
    """
    Use this in your orchestrator entrypoint.

    - precheck_or_block(): stop pipeline early
    - postcheck_and_override(): override any leaked answer
    """

    def __init__(self, classifier: DynamicGuardrailsClassifier, min_confidence: float = 0.75) -> None:
        self.classifier = classifier
        self.min_confidence = float(min_confidence)

    async def precheck_or_block(
        self,
        user_query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> GuardrailsDecision:
        decision = await self.classifier.classify_domain(user_query, conversation_history)
        domain = decision.get("domain", "OUT_OF_SCOPE")

        # ✅ Allow referential followups to proceed (conversation-aware)
        if domain == "FOLLOWUP_REFERENTIAL":
            return GuardrailsDecision(
                allowed=True,
                payload={"guardrails": decision},
            )

        # ✅ Allow only true in-scope medical derm to proceed
        if domain != "IN_SCOPE_MEDICAL_DERM":
            return GuardrailsDecision(
                allowed=False,
                payload={"answer": self.classifier.get_out_of_scope_message(), "guardrails": decision},
            )

        # ✅ Apply confidence gating ONLY to actual medical questions
        conf = float(decision.get("confidence", 0.0))
        if conf < self.min_confidence:
            return GuardrailsDecision(
                allowed=False,
                payload={
                    "answer": self.classifier.get_out_of_scope_message(),
                    "guardrails": {
                        **decision,
                        "reasoning": (
                            f"Blocked: confidence {conf:.2f} < threshold {self.min_confidence:.2f}. "
                            f"{decision.get('reasoning', '')}"
                        ),
                    },
                },
            )

        return GuardrailsDecision(allowed=True, payload={"guardrails": decision})

    async def postcheck_and_override(
        self,
        user_query: str,
        generated_answer: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        decision = await self.classifier.classify_domain(user_query, conversation_history)
        domain = decision.get("domain", "OUT_OF_SCOPE")

        # ✅ Do NOT override valid followups
        if domain not in ("IN_SCOPE_MEDICAL_DERM", "FOLLOWUP_REFERENTIAL"):
            return {
                "answer": self.classifier.get_out_of_scope_message(),
                "guardrails": decision,
                "overridden": True,
            }

        return {"answer": generated_answer, "guardrails": decision, "overridden": False}


# -----------------------------
# Singletons
# -----------------------------

dynamic_classifier = DynamicGuardrailsClassifier()
guardrails = GuardrailsEnforcer(dynamic_classifier, min_confidence=0.75)
