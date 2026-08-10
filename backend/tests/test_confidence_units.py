"""T009 [US5] -- one confidence, one unit, one number.

`to_percent` is already correct and is protected here, not rewritten.

Reproduces: the rendered header reads `medical_analyses.confidence` through
`to_percent` (pdf_generator.py:617), while the metric box reads
`classification_metrics.confidence` and multiplies by 100 unconditionally
(pdf_generator.py:644). For a row that stored percentages in both places the
document prints `87.3` in the header beside `8730.0%` in the metric box
(FR-026 - FR-028, A6b/A6c).
"""

import re

import pytest

from app.services.pdf_generator import generate_pdf
from app.services.report_generator import to_percent
from helpers import build_report_data, pdf_text

PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")


# --------------------------------------------------------------------------- #
# to_percent -- [already satisfied -- protect]
# --------------------------------------------------------------------------- #

def test_to_percent_accepts_both_units():
    assert to_percent(0.9) == to_percent(90.0) == 90.0


@pytest.mark.parametrize(
    "stored,expected",
    [(0.873, 87.3), (87.3, 87.3), (1.0, 100.0), (0.0, 0.0), (100.0, 100.0)],
)
def test_to_percent_is_idempotent_across_units(stored, expected):
    assert to_percent(stored) == pytest.approx(expected, abs=0.001)


def test_to_percent_survives_junk():
    assert to_percent(None) == 0.0
    assert to_percent("not a number") == 0.0


# --------------------------------------------------------------------------- #
# The rendered document -- the two readers must agree
# --------------------------------------------------------------------------- #

def _rendered_confidences(analysis) -> list:
    """Every distinct percentage the clinician document prints for confidence."""
    text = pdf_text(generate_pdf(build_report_data(analysis), "clinician_report"))
    return text, [float(m) for m in PERCENT.findall(text)]


def test_raw_probability_row_shows_one_confidence(analysis_complete):
    text, values = _rendered_confidences(analysis_complete)
    header = to_percent(analysis_complete["confidence"])
    assert header == pytest.approx(87.3, abs=0.05)
    assert any(v == pytest.approx(header, abs=0.05) for v in values), text[:400]
    # No figure may exceed 100%: that is the multiply-twice signature.
    assert not [v for v in values if v > 100.0], f"impossible percentages: {values}"


def test_legacy_percentage_row_shows_one_confidence(analysis_legacy_percent_confidence):
    """The reproduction: 87.3 in the header, 8730.0% in the metric box."""
    text, values = _rendered_confidences(analysis_legacy_percent_confidence)
    header = to_percent(analysis_legacy_percent_confidence["confidence"])
    assert header == pytest.approx(87.3, abs=0.05)
    assert not [v for v in values if v > 100.0], (
        f"header says {header}, document also prints {[v for v in values if v > 100.0]}"
    )


@pytest.mark.parametrize(
    "fixture_name", ["analysis_complete", "analysis_legacy_percent_confidence"]
)
def test_header_and_metric_box_agree(fixture_name, request):
    """The two readers, compared directly rather than scraped out of the text.

    The header takes the column through `to_percent`; the metric box takes the
    jsonb and multiplies by 100 unconditionally. Asserting that the header's own
    number appears in the document is tautological -- it always does. Compare the
    two expressions instead.
    """
    analysis = request.getfixturevalue(fixture_name)
    header = to_percent(analysis["confidence"])
    metric_box = float(analysis["classification_metrics"]["confidence"]) * 100.0
    assert metric_box == pytest.approx(header, abs=0.05), (
        f"{fixture_name}: header renders {header}, metric box renders {metric_box}"
    )
