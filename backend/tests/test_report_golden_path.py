"""T011 [US1] -- the golden path, pinned before anything else moves.

Phase A carried no happy-path test. Every other task in this feature edits the
report pipeline, and nothing yet states what a *correct* report looks like. This
does, end to end and offline: a well-formed narrative through
`generate_llm_content`, rendered by `generate_pdf`, for all four report types.

Four claims, per type:
  1. the outcome is `completed`                      FR-016, FR-018
  2. all four narrative sections were produced       FR-018, SC-006a
  3. the supplied report number renders verbatim     FR-022, FR-023
  4. the document prints one confidence value        FR-026 - FR-028

CONTRACT ASSUMED (T018 + T038), identical to `test_report_degradation.py`:
`generate_llm_content` returns a `provenance` mapping alongside its content keys,
and `degraded_reason is None` is what `completed` means.

The stub is applied at the model boundary (`create_chat_completion`), never at
the function under test. WeasyPrint renders locally. No network, no Supabase, no
credentials.
"""

import asyncio
import re
from types import SimpleNamespace

import pytest

from app.services import report_generator
from app.services.pdf_generator import generate_pdf
from app.services.report_generator import to_percent
from helpers import REPORT_TYPES, SUPPLIED_REPORT_NUMBER, build_report_data, pdf_text

MODEL_ID = "meta/llama-3.3-70b-instruct"

NARRATIVE_SECTIONS = ("summary", "observations", "recommendations", "limitations")

PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")

# One distinctive fragment per section of `narrative_structured`, chosen to avoid
# punctuation the PDF text extractor re-encodes (apostrophes, em dashes).
SECTION_FRAGMENTS = {
    "summary": "leading classification for this lesion is melanoma",
    "observations": "percentage points above the second",
    "recommendations": "Book a dermatology appointment within two weeks",
    "limitations": "does not replace biopsy",
}


def _generate(analysis, raw, report_type, monkeypatch):
    """Drive `generate_llm_content` with `raw` as the model's whole response."""

    def _fake_completion(*_args, **_kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=raw))]), MODEL_ID

    monkeypatch.setattr(report_generator, "get_nvidia_client", lambda: object())
    monkeypatch.setattr(report_generator, "create_chat_completion", _fake_completion)
    return asyncio.run(report_generator.generate_llm_content(analysis, report_type))


def _render(analysis, content, report_type) -> str:
    """Render the generated narrative the way the endpoint assembles it."""
    report_data = build_report_data(
        analysis,
        llm_summary=content["summary"],
        llm_observations=content["observations"],
        llm_limitations=content["limitations"],
        llm_recommendations=content["recommendations"],
    )
    return pdf_text(generate_pdf(report_data, report_type))


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text)


# --------------------------------------------------------------------------- #
# 1 + 2. The outcome and its provenance
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_well_formed_narrative_is_completed(
    analysis_complete, narrative_structured, report_type, monkeypatch
):
    content = _generate(analysis_complete, narrative_structured, report_type, monkeypatch)
    assert content["provenance"]["degraded_reason"] is None


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_well_formed_narrative_reports_four_of_four_sections(
    analysis_complete, narrative_structured, report_type, monkeypatch
):
    content = _generate(analysis_complete, narrative_structured, report_type, monkeypatch)
    assert content["provenance"]["sections_generated"] == {s: True for s in NARRATIVE_SECTIONS}


# --------------------------------------------------------------------------- #
# The narrative reaches the document -- [protect]
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_every_generated_section_reaches_the_document(
    analysis_complete, narrative_structured, report_type, monkeypatch
):
    """Four sections claimed as generated must be four sections a reader can see.

    T038 rewrites the classifier and T041 adds a provenance block to both
    templates; either could keep the claim while dropping the content.
    """
    content = _generate(analysis_complete, narrative_structured, report_type, monkeypatch)
    text = _squash(_render(analysis_complete, content, report_type))

    for section, fragment in SECTION_FRAGMENTS.items():
        assert fragment in text, f"{report_type}: {section} never reached the document"


# --------------------------------------------------------------------------- #
# 3. Report number -- [protect]
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_supplied_report_number_renders_verbatim(
    analysis_complete, narrative_structured, report_type, monkeypatch
):
    content = _generate(analysis_complete, narrative_structured, report_type, monkeypatch)
    text = _render(analysis_complete, content, report_type)
    assert SUPPLIED_REPORT_NUMBER in text.replace("\n", "")


# --------------------------------------------------------------------------- #
# 4. One confidence value -- [protect]
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_document_prints_one_confidence_value(
    analysis_complete, narrative_structured, report_type, monkeypatch
):
    """The header's number is present, and no second, differently-scaled one is.

    A percentage above 100 is the multiply-twice signature T009 reproduces on the
    legacy row; on the golden path it must never appear for any type.
    """
    content = _generate(analysis_complete, narrative_structured, report_type, monkeypatch)
    text = _render(analysis_complete, content, report_type)
    values = [float(v) for v in PERCENT.findall(text)]
    header = to_percent(analysis_complete["confidence"])

    assert any(v == pytest.approx(header, abs=0.05) for v in values), (
        f"{report_type} never printed the header confidence {header}"
    )
    assert not [v for v in values if v > 100.0], (
        f"{report_type} printed impossible percentages: {[v for v in values if v > 100.0]}"
    )
