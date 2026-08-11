"""The report contract, Python half.

`frontend/src/lib/reports/contract.ts` is the other half and must hold the same
values in the same order. Nothing in this toolchain generates one from the other
-- there is no codegen step and CI verifies nothing -- so `tests/test_report_contract.py`
reads the TypeScript file as text and asserts the two agree. Change one, change
both, in the same edit.

Source of truth: `.specify/specs/001-report-generation-integrity/contracts/report-contract.md`.
"""

from typing import Any, Dict, Optional

try:  # TypedDict moved into typing at 3.8; Required/NotRequired are not used here.
    from typing import TypedDict
except ImportError:  # pragma: no cover - the venv is 3.10
    from typing_extensions import TypedDict


# --------------------------------------------------------------------------- #
# Closed sets (contract §1). Membership is closed: a value outside a set is an
# error, never a substitution.
# --------------------------------------------------------------------------- #

REPORT_TYPES = (
    "diagnostic_summary",
    "detailed_analysis",
    "patient_report",
    "clinician_report",
)

REPORT_STATUSES = (
    "pending",
    "generating",
    "completed",
    "degraded",
    "failed",
)

NARRATIVE_SECTIONS = (
    "summary",
    "observations",
    "recommendations",
    "limitations",
)

# `processing` is deliberately absent. Nothing has ever written it; it survives
# only in a consumer (`services/dashboard.server.ts`) and is removed there by T029.

# Every permitted edge, exhaustively (data-model.md "State transitions").
# No edge leaves a terminal state -- FR-041a.
ALLOWED_TRANSITIONS = frozenset(
    {
        ("pending", "generating"),
        ("pending", "failed"),
        ("generating", "completed"),
        ("generating", "degraded"),
        ("generating", "failed"),
    }
)

TERMINAL_STATUSES = frozenset({"completed", "degraded", "failed"})

# Migration 007's CHECK constraint. A looser pattern here fails at insert time.
REPORT_NUMBER_PATTERN = r"^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$"


class ReportProvenance(TypedDict):
    """What the narrative generator produced, and what it did not.

    `degraded_reason is None` is what `completed` means; a non-null reason is what
    `degraded` means. Serialised into the `X-Report-*` response headers by T039 and
    persisted into the `014` columns by T043.

    A historical row carries no provenance at all. That is `None`, and it renders
    as "provenance unavailable" -- never as complete (Assumption 2).
    """

    sections_generated: Dict[str, bool]
    generator: str
    degraded_reason: Optional[str]


def error_body(
    code: str, message: str, details: Optional[str] = None
) -> Dict[str, Any]:
    """The contract §6 error envelope, and the only shape either side emits.

    `details` is omitted rather than null when absent, so a consumer can test for
    its presence. It MUST NOT carry credentials, another person's storage path, or
    a raw upstream payload beyond a truncated excerpt -- the caller is responsible
    for what it passes here.
    """
    body: Dict[str, Any] = {"error": message, "code": code}
    if details is not None:
        body["details"] = details
    return body
