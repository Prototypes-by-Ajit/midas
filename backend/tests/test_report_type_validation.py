"""T007 [US3] -- an unsupported report type must be refused, never substituted.

Reproduces: `normalize_report_type` silently returns `diagnostic_summary` for any
unrecognised value (FR-010, FR-011; edge case 10). A person who asked for one
document silently receives a different one.

T047 replaces `normalize_report_type` with `validate_report_type`. This test
resolves whichever name is present so it keeps guarding the behaviour across that
rename instead of having to be edited by the task it exists to check.
"""

import pytest
from fastapi import HTTPException

from app.api import reports
from helpers import REPORT_TYPES


def _validate(value: str) -> str:
    resolver = getattr(reports, "validate_report_type", None) or reports.normalize_report_type
    return resolver(value)


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_each_supported_type_passes_through_unchanged(report_type):
    # [already satisfied -- protect]
    assert _validate(report_type) == report_type


@pytest.mark.parametrize(
    "bogus",
    [
        "bogus",
        "",
        "DIAGNOSTIC_SUMMARY",
        "diagnostic-summary",
        "patient",
        "summary; drop table generated_reports",
    ],
)
def test_unsupported_type_is_refused_not_coerced(bogus):
    with pytest.raises(HTTPException) as excinfo:
        _validate(bogus)
    assert excinfo.value.status_code == 422


def test_refusal_names_all_four_supported_types():
    with pytest.raises(HTTPException) as excinfo:
        _validate("bogus")
    detail = str(excinfo.value.detail)
    for report_type in REPORT_TYPES:
        assert report_type in detail, f"{report_type} absent from refusal: {detail!r}"


def test_refusal_does_not_echo_the_rejected_value_as_a_substitution():
    # The specific defect: the caller must not be told, or shown, that their
    # request was quietly turned into a diagnostic_summary.
    try:
        result = _validate("bogus")
    except HTTPException:
        return
    pytest.fail(f"coerced to {result!r} instead of refusing")
