"""T010 [US5] -- what the rendered document is and is not allowed to say.

Renders all four report types from static fixtures and inspects the extracted
text. Offline: WeasyPrint is local, no Supabase, no model call.

(a) no prohibited dataset-level measure appears in any type   [protect]
(b) the report number is the supplied one, never the ten-digit fallback  FR-022, FR-023
(c) a row with no probability distribution says so             FR-031
(d) a row with no overlay discloses that                       FR-017, FR-040a
(e) a degraded narrative names every absent section            FR-029, SC-012
"""

import pytest

from app.services.pdf_generator import generate_pdf
from helpers import (
    CANONICAL_REPORT_NUMBER,
    NONCANONICAL_REPORT_NUMBER,
    PROHIBITED_MEASURES,
    REPORT_TYPES,
    SUPPLIED_REPORT_NUMBER,
    build_report_data,
    pdf_text,
    report_numbers,
)


def _render(analysis, report_type, **kwargs) -> str:
    return pdf_text(generate_pdf(build_report_data(analysis, **kwargs), report_type))


# --------------------------------------------------------------------------- #
# (a) prohibited measures -- [already satisfied -- protect]
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_no_dataset_level_measure_is_rendered(analysis_complete, report_type):
    text = _render(analysis_complete, report_type)
    found = PROHIBITED_MEASURES.findall(text)
    assert not found, f"{report_type} rendered prohibited measure(s): {sorted(set(found))}"


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_no_prohibited_measure_even_when_the_row_carries_one(analysis_complete, report_type):
    poisoned = {
        **analysis_complete,
        "classification_metrics": {
            **analysis_complete["classification_metrics"],
            "accuracy": 0.9131,
            "precision": 0.88,
            "recall": 0.5576,
        },
    }
    text = _render(poisoned, report_type)
    found = PROHIBITED_MEASURES.findall(text)
    assert not found, f"{report_type} leaked {sorted(set(found))} from the row"


# --------------------------------------------------------------------------- #
# (b) report number
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_supplied_report_number_is_rendered_verbatim(analysis_complete, report_type):
    text = _render(analysis_complete, report_type)
    assert SUPPLIED_REPORT_NUMBER in text.replace("\n", "")


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_report_number_never_takes_the_ten_digit_form(analysis_complete, report_type):
    """The fallback at pdf_generator.py:677 violates the 007 CHECK constraint."""
    text = _render(analysis_complete, report_type, report_number=None)
    offending = NONCANONICAL_REPORT_NUMBER.findall(text)
    assert not offending, f"{report_type} printed a non-canonical number: {offending}"


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_fallback_number_matches_the_canonical_pattern(analysis_complete, report_type):
    text = _render(analysis_complete, report_type, report_number=None)
    numbers = report_numbers(text)
    assert numbers, f"{report_type} rendered no report number at all"
    for number in numbers:
        assert CANONICAL_REPORT_NUMBER.match(number), f"{number!r} is not canonical"


# --------------------------------------------------------------------------- #
# (c) absent probability distribution
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", ["clinician_report", "detailed_analysis"])
def test_absent_distribution_is_stated_not_silently_dropped(
    analysis_no_distribution, report_type
):
    text = _render(analysis_no_distribution, report_type).lower()
    assert "unavailable" in text or "not available" in text or "was not recorded" in text, (
        "the differential section vanished without saying why"
    )


# --------------------------------------------------------------------------- #
# (d) absent overlay
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_absent_overlay_is_disclosed(analysis_no_overlay, report_type):
    """Edge case 6: produced without the overlay, and says the overlay is absent."""
    text = _render(analysis_no_overlay, report_type, heatmap_url=None).lower()
    assert "overlay" in text or "heatmap" in text or "highlight" in text, (
        "no mention of the image overlay at all -- its absence is silent"
    )
    assert "unavailable" in text or "not available" in text or "was not" in text, (
        "the overlay is absent but the document does not disclose it"
    )


def test_absent_overlay_never_claims_the_overlay_was_reviewed(analysis_no_overlay):
    text = _render(analysis_no_overlay, "clinician_report", heatmap_url=None).lower()
    for claim in ("heatmap analysis", "as shown in the heatmap", "the highlighted region"):
        assert claim not in text, f"claims an overlay that does not exist: {claim!r}"


# --------------------------------------------------------------------------- #
# (e) degraded narrative
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_degraded_report_names_every_absent_section(analysis_complete, report_type):
    """Prose-only: summary survives, three sections absent and each must be named."""
    text = _render(
        analysis_complete,
        report_type,
        llm_summary="The leading classification for this lesion is melanoma.",
        llm_observations="",
        llm_limitations="",
        llm_recommendations=[],
    ).lower()

    for absent in ("observations", "recommendations", "limitations"):
        assert absent in text, f"{report_type}: absent section {absent!r} is not named"


def test_degraded_report_says_it_is_incomplete(analysis_complete):
    text = _render(
        analysis_complete,
        "patient_report",
        llm_summary="The leading classification for this lesion is melanoma.",
    ).lower()
    assert "incomplete" in text, "a degraded document must use the same word the screen uses"
