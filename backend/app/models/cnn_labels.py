"""
Class labels and risk tiers for the MIDAS CNN.

Torch-free on purpose: the ONNX serving path and the report generator import
these without pulling torch/timm into the process.
"""

# Class mappings (HAM10000 dataset)
CLASS_NAMES = {
    0: "AKIEC",  # Actinic Keratoses and Intraepithelial Carcinoma
    1: "BCC",    # Basal Cell Carcinoma
    2: "BKL",    # Benign Keratosis-like Lesions
    3: "DF",     # Dermatofibroma
    4: "MEL",    # Melanoma
    5: "NV",     # Melanocytic Nevi
    6: "VASC"    # Vascular Lesions
}

CLASS_DESCRIPTIONS = {
    "AKIEC": "Actinic Keratoses and Intraepithelial Carcinoma",
    "BCC": "Basal Cell Carcinoma",
    "BKL": "Benign Keratosis-like Lesions",
    "DF": "Dermatofibroma",
    "MEL": "Melanoma",
    "NV": "Melanocytic Nevi (Common Mole)",
    "VASC": "Vascular Lesions"
}

# Risk level mapping
RISK_LEVELS = {
    "AKIEC": "medium",
    "BCC": "high",
    "BKL": "low",
    "DF": "low",
    "MEL": "high",
    "NV": "low",
    "VASC": "low"
}

RISK_INDETERMINATE = "indeterminate"

_HIGH_RISK_CLASSES = frozenset(c for c, r in RISK_LEVELS.items() if r == "high")


def resolve_risk_level(predicted_class: str, class_probabilities: dict) -> str:
    """Risk tier for a prediction, or "indeterminate" when it isn't supported.

    Looking up RISK_LEVELS directly ignores how sure the model was, which is
    wrong because the tier is a decision, not a display: it selects the clinical
    advice, goes into the PDF, and is fed to the report LLM. A nevus predicted
    at 22% would otherwise return "low" and recommend a 6-12 month follow-up.

    Parameter-free by design. No held-out data is available in the repo, so any
    tuned cut-point would be an invented number -- exactly what this function
    exists to stop. One criterion, "does it hold the majority", applied twice:

    * Support: assert a tier only when the predicted class carries more
      probability mass than every other class combined.
    * Escalate, never downgrade: a "low" tier additionally requires that the
      high-risk classes do NOT hold the majority of the remaining mass. A
      decisive nevus with a 2% melanoma runner-up stays low; a 55% nevus with
      30% melanoma behind it does not.

    Note this deliberately tests mass, not rank. Ranking alone would escalate
    every prediction whose second place happens to be melanoma, however small.
    """
    base = RISK_LEVELS.get(predicted_class)
    if base is None:
        return RISK_INDETERMINATE

    probabilities = class_probabilities or {}
    top = probabilities.get(predicted_class)
    if top is None:
        # No distribution to reason about; do not invent certainty.
        return RISK_INDETERMINATE

    alternatives = sum(probabilities.values()) - top
    high_risk_mass = sum(p for c, p in probabilities.items() if c in _HIGH_RISK_CLASSES)

    if top <= alternatives:
        # The alternatives outweigh the call, so no tier is supported. Still
        # escalate rather than stay silent when a high-risk class is in play.
        high_risk_ranked_top2 = any(
            c in _HIGH_RISK_CLASSES
            for c, _ in sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)[:2]
        )
        return "medium" if high_risk_ranked_top2 else RISK_INDETERMINATE

    if base == "low" and high_risk_mass > alternatives - high_risk_mass:
        return "medium"
    return base
