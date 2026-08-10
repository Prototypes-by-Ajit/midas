"""Shared, offline test helpers.

`tests/` carries no `__init__.py`, so pytest's default `prepend` import mode puts
this directory on `sys.path` and the test modules reach this as `import helpers`.
"""

import io
import re
from typing import Any, Dict, List, Optional

from PyPDF2 import PdfReader

# The four supported report types, from spec.md FR-010.
REPORT_TYPES = (
    "diagnostic_summary",
    "detailed_analysis",
    "patient_report",
    "clinician_report",
)

# FR-030: dataset-level model performance figures that must never reach a
# rendered document in any form.
PROHIBITED_MEASURES = re.compile(
    r"\b(accuracy|balanced accuracy|auroc|auc|precision|recall|f1|"
    r"specificity|sensitivity|ppv|npv)\b",
    re.IGNORECASE,
)

# The divergent fallback shape at pdf_generator.py:677 -- "MIDAS-REP-" plus a
# ten-digit timestamp. The canonical form (migration 007) is
# MIDAS-REP-YYYYMMDD-XXXXXX, so anything matching this is the defect.
NONCANONICAL_REPORT_NUMBER = re.compile(r"MIDAS-REP-\d{10}(?!\d)")
CANONICAL_REPORT_NUMBER = re.compile(r"^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$")

# Extracted PDF text does not reliably put whitespace after the number -- the
# clinician template yields "MIDAS-REP-2608092131Report". Scan with a regex
# rather than splitting on whitespace, or the clinician case silently passes.
_ANY_REPORT_NUMBER = re.compile(r"MIDAS-REP-[0-9A-Z-]*[0-9A-Z]")


def report_numbers(text: str) -> List[str]:
    """Every MIDAS report number appearing in extracted document text."""
    return _ANY_REPORT_NUMBER.findall(text)

SUPPLIED_REPORT_NUMBER = "MIDAS-REP-20260714-K3P9XQ"


def pdf_text(pdf_bytes: bytes) -> str:
    """Extract every page's text from rendered PDF bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def build_report_data(
    analysis: Dict[str, Any],
    *,
    report_number: Optional[str] = SUPPLIED_REPORT_NUMBER,
    heatmap_url: Optional[str] = None,
    llm_summary: str = "",
    llm_observations: str = "",
    llm_limitations: str = "",
    llm_recommendations: Optional[List[str]] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble the payload `pdf_generator.generate_pdf` expects.

    Mirrors what `reports._build_report_context` returns, without touching
    Supabase. `heatmap_url` defaults to None so the caller must opt in to an
    overlay, matching the fixtures that have no stored overlay.
    """
    return {
        "report_id": "b4d1e7f0-1234-4c56-89ab-cdef01234567",
        "report_type": "diagnostic_summary",
        "analysis": analysis,
        "heatmap_url": heatmap_url,
        "config": {
            "includeImages": True,
            "includeDetailedFeatures": True,
            "includeRecommendations": True,
            "includeDisclaimer": True,
            **(config or {}),
        },
        "user_id": analysis["user_id"],
        "report_number": report_number,
        "llm_summary": llm_summary,
        "llm_observations": llm_observations,
        "llm_limitations": llm_limitations,
        "llm_recommendations": llm_recommendations or [],
    }


class FakeSupabase:
    """Minimal stand-in for the supabase-py client used by `_build_report_context`.

    Records the filters applied so a test can prove an owner predicate was or was
    not sent, and returns `rows` for whatever survives them. No network.
    """

    def __init__(self, rows: List[Dict[str, Any]]):
        self._rows = rows
        self.filters: List[tuple] = []
        self.storage_calls: List[str] = []

    # -- query builder surface -------------------------------------------------
    def table(self, _name: str) -> "FakeSupabase":
        return self

    def select(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def eq(self, column: str, value: Any) -> "FakeSupabase":
        self.filters.append((column, value))
        return self

    def limit(self, _n: int) -> "FakeSupabase":
        return self

    def execute(self) -> "FakeResult":
        rows = self._rows
        for column, value in self.filters:
            rows = [r for r in rows if r.get(column) == value]
        return FakeResult(rows)

    # -- storage surface -------------------------------------------------------
    @property
    def storage(self) -> "FakeSupabase":
        return self

    def from_(self, bucket: str) -> "FakeSupabase":
        self.storage_calls.append(bucket)
        return self

    def download(self, path: str) -> bytes:
        self.storage_calls.append(path)
        raise FileNotFoundError(path)


class FakeResult:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data
