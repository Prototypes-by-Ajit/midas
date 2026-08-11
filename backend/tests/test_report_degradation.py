"""T006 [US2] -- narrative degradation must be classified on usable content.

Reproduces: `report_generator` falls back to `{"summary": raw}` with only a
`logger.warning`, and an empty response normalizes to a dict of empty strings
that renders as clinical narrative (FR-016, FR-016a, FR-018; edge cases 3 and 4).

CONTRACT ASSUMED (T018 + T038 + T039). `generate_llm_content` returns, alongside
its content keys, a `provenance` mapping:

    {"sections_generated": {"summary": bool, "observations": bool,
                            "recommendations": bool, "limitations": bool},
     "generator": "<the model that actually answered>",
     "degraded_reason": None | "<why sections are missing>"}

`degraded_reason is None` is what `completed` means; a non-null reason is what
`degraded` means. T039 serialises exactly these three into `X-Report-Sections`,
`X-Report-Generator` and `X-Report-Degraded`.

The stub is applied at the model boundary (`create_chat_completion`), not at
`generate_llm_content` itself -- stubbing the function under test would assert
nothing. No network, no credentials.
"""

import asyncio
import json
from types import SimpleNamespace

import pytest

from app.services import report_generator

MODEL_ID = "meta/llama-3.3-70b-instruct"

NARRATIVE_SECTIONS = ("summary", "observations", "recommendations", "limitations")


def _run(analysis, raw, report_type="diagnostic_summary", monkeypatch=None, model=MODEL_ID):
    """Drive `generate_llm_content` with `raw` as the model's whole response."""

    def _fake_completion(*_args, **_kwargs):
        message = SimpleNamespace(content=raw)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)]), model

    monkeypatch.setattr(report_generator, "get_nvidia_client", lambda: object())
    monkeypatch.setattr(report_generator, "create_chat_completion", _fake_completion)
    return asyncio.run(report_generator.generate_llm_content(analysis, report_type))


def test_structured_response_reports_four_of_four_sections(
    analysis_complete, narrative_structured, monkeypatch
):
    result = _run(analysis_complete, narrative_structured, monkeypatch=monkeypatch)

    provenance = result["provenance"]
    assert provenance["sections_generated"] == {s: True for s in NARRATIVE_SECTIONS}
    # completed
    assert provenance["degraded_reason"] is None


def test_structured_response_records_the_real_generator(
    analysis_complete, narrative_structured, monkeypatch
):
    result = _run(
        analysis_complete, narrative_structured, monkeypatch=monkeypatch, model="some/other-model-v2"
    )
    # FR-018: the identity of the model that actually answered, never a constant.
    assert result["provenance"]["generator"] == "some/other-model-v2"


def test_prose_only_response_is_degraded_and_names_the_absent_sections(
    analysis_complete, narrative_prose_only, monkeypatch
):
    result = _run(analysis_complete, narrative_prose_only, monkeypatch=monkeypatch)

    provenance = result["provenance"]
    assert provenance["sections_generated"]["summary"] is True
    for absent in ("observations", "recommendations", "limitations"):
        assert provenance["sections_generated"][absent] is False, absent

    reason = provenance["degraded_reason"]
    assert reason, "a degraded report must say why"
    for absent in ("observations", "recommendations", "limitations"):
        assert absent in reason.lower(), f"{absent} is missing but unnamed in: {reason!r}"


def test_prose_only_response_still_delivers_the_prose(
    analysis_complete, narrative_prose_only, monkeypatch
):
    # Edge case 3: degraded, but the usable prose is still delivered.
    result = _run(analysis_complete, narrative_prose_only, monkeypatch=monkeypatch)
    assert "melanoma" in result["summary"].lower()


def test_empty_response_raises_rather_than_returning_renderable_content(
    analysis_complete, narrative_empty, monkeypatch
):
    # Edge case 4: nothing usable is `failed`, never `degraded`, and never a
    # document. Returning a dict of empty strings is the defect.
    with pytest.raises(Exception) as excinfo:
        _run(analysis_complete, narrative_empty, monkeypatch=monkeypatch)
    assert not isinstance(excinfo.value, (KeyError, AttributeError)), (
        "must fail deliberately, not by attribute lookup"
    )


def test_refusal_response_raises(analysis_complete, monkeypatch):
    refusal = "I'm sorry, but I can't help with that request."
    with pytest.raises(Exception) as excinfo:
        _run(analysis_complete, refusal, monkeypatch=monkeypatch)
    assert not isinstance(excinfo.value, (KeyError, AttributeError))


def test_structured_recommendations_survive_as_a_list(
    analysis_complete, narrative_structured, monkeypatch
):
    result = _run(analysis_complete, narrative_structured, monkeypatch=monkeypatch)
    assert isinstance(result["recommendations"], list)
    assert len(result["recommendations"]) == len(
        json.loads(narrative_structured)["recommendations"]
    )
