"""
Offline guard for report generation being per-analysis rather than boilerplate.

No network, no database. Run from backend/ with the venv active:
    python test_report_dynamism.py
"""
from app.services.report_generator import (
    build_user_prompt,
    parse_llm_json,
    ranked_probabilities,
    to_percent,
)


def _analysis(diagnosis, confidence, probabilities, top2_gap, entropy):
    return {
        "diagnosis": diagnosis,
        "confidence": confidence,
        "risk_level": "high",
        "classification_metrics": {
            "confidence": confidence,
            "top2_gap": top2_gap,
            "entropy": entropy,
            "class_probabilities": probabilities,
        },
    }


# A decisive melanoma call.
CONFIDENT = _analysis(
    "Melanoma", 0.94,
    {"MEL": 0.94, "NV": 0.03, "BKL": 0.01, "BCC": 0.01, "AKIEC": 0.005, "DF": 0.003, "VASC": 0.002},
    0.91, 0.34,
)
# Same top label, but the model is genuinely torn between MEL and NV.
UNCERTAIN = _analysis(
    "Melanoma", 0.41,
    {"MEL": 0.41, "NV": 0.38, "BKL": 0.10, "BCC": 0.05, "AKIEC": 0.03, "DF": 0.02, "VASC": 0.01},
    0.03, 1.42,
)


def test_to_percent():
    assert to_percent(0.93) == 93.0, "0-1 CNN score must convert to percent"
    assert to_percent(93.0) == 93.0, "already-percent values must pass through"
    assert to_percent(1.0) == 100.0
    assert to_percent(0) == 0.0
    assert to_percent(None) == 0.0, "must not raise on a null confidence"
    print("ok  to_percent")


def test_ranked_probabilities():
    ranked = ranked_probabilities(CONFIDENT)
    assert len(ranked) == 7
    assert ranked[0][0].endswith("(MEL)"), ranked[0]
    assert abs(ranked[0][1] - 94.0) < 0.001
    assert ranked == sorted(ranked, key=lambda item: item[1], reverse=True)
    # Rows written before class_probabilities was persisted must not blow up.
    assert ranked_probabilities({"classification_metrics": {}}) == []
    assert ranked_probabilities({}) == []
    assert ranked_probabilities({"classification_metrics": "not json"}) == []
    print("ok  ranked_probabilities")


def test_prompt_is_per_analysis():
    """The regression guard: same diagnosis, different certainty => different prompt."""
    for report_type in ("patient_report", "detailed_analysis", "clinician_report"):
        confident = build_user_prompt(CONFIDENT, report_type)
        uncertain = build_user_prompt(UNCERTAIN, report_type)
        assert confident != uncertain, f"{report_type} prompt is identical across analyses"
        assert "94.0%" in confident and "41.0%" in uncertain
        # The competing class must be visible so the model can reason about it.
        assert "(NV)" in uncertain
        assert "91.0 percentage points" in confident
        assert "3.0 percentage points" in uncertain
    print("ok  prompt_is_per_analysis")


def test_prompt_survives_legacy_rows():
    legacy = {"diagnosis": "Melanocytic Nevi", "confidence": 0.88, "risk_level": "low"}
    prompt = build_user_prompt(legacy, "clinician_report")
    assert "88.0%" in prompt
    assert "differential is unavailable" in prompt
    print("ok  prompt_survives_legacy_rows")


def test_parse_llm_json():
    payload = '{"summary": "s", "recommendations": ["a", "b"]}'

    assert parse_llm_json(payload)["summary"] == "s"
    assert parse_llm_json(f"```json\n{payload}\n```")["recommendations"] == ["a", "b"]
    assert parse_llm_json(f"```\n{payload}\n```")["summary"] == "s"
    assert parse_llm_json(f"Here you go:\n{payload}\nHope that helps")["summary"] == "s"
    # Malformed output degrades to prose rather than raising.
    assert parse_llm_json("not json at all")["summary"] == "not json at all"
    assert parse_llm_json("")["summary"] == ""
    print("ok  parse_llm_json")


def test_pdf_renders_with_llm_content():
    """Smoke test the render path, including the confidence unit fix."""
    from app.services.pdf_generator import generate_pdf

    report_data = {
        "report_id": "test-id",
        "report_number": "MIDAS-REP-20260731-ABC123",
        "user_id": "user_test",
        "analysis": CONFIDENT,
        "heatmap_url": None,
        "config": {
            "includeImages": True,
            "includeDetailedFeatures": True,
            "includeRecommendations": True,
            "includeDisclaimer": True,
        },
        "llm_summary": "Narrative paragraph one.\n\nNarrative paragraph two.",
        "llm_observations": "Asymmetric pigmented lesion.",
        "llm_recommendations": ["Refer for excisional biopsy", "Photograph for comparison"],
        "llm_limitations": "Image-based analysis cannot assess depth.",
    }

    for report_type in ("patient_report", "clinician_report"):
        pdf = generate_pdf(report_data, report_type)
        assert pdf.startswith(b"%PDF"), f"{report_type} did not render a PDF"
        assert len(pdf) > 1000, f"{report_type} PDF suspiciously small"
    print("ok  pdf_renders_with_llm_content")


if __name__ == "__main__":
    test_to_percent()
    test_ranked_probabilities()
    test_prompt_is_per_analysis()
    test_prompt_survives_legacy_rows()
    test_parse_llm_json()
    test_pdf_renders_with_llm_content()
    print("\nAll report dynamism checks passed.")
