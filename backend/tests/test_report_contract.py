"""T014 -- the two contract modules must agree, across the language boundary.

Nothing else in this toolchain can detect drift between
`frontend/src/lib/reports/contract.ts` and `backend/app/contracts/report_contract.py`:
there is no codegen step, no shared schema, and no CI that builds either side
(`.github/workflows/ci.yml` only echoes). So the TypeScript module is read as
**text** -- no build, no node, no import -- and its literals are compared with the
Python module's (contract §7, FR-041, FR-043).

The second half asserts the vocabulary is actually spoken. `dashboard.server.ts:14`
counts in-flight reports as `["pending", "processing"]`, and `"processing"` is a
value no writer in this system has ever produced, so that count is always zero.
`PENDING_ANALYSIS` on the line above is a *different* vocabulary -- the
`medical_analyses.status` column, where `processing` is real -- and is
deliberately left alone (T029).
"""

import re
from pathlib import Path

import pytest

# tests/ -> backend/ -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]

CONTRACT_TS = REPO_ROOT / "frontend/src/lib/reports/contract.ts"
DASHBOARD_SERVER_TS = REPO_ROOT / "frontend/src/services/dashboard.server.ts"
REPORT_ROUTES = REPO_ROOT / "frontend/src/app/api/reports"

# Contract §1. Named here so a drift in *both* modules at once still fails.
EXPECTED = {
    "REPORT_TYPES": (
        "diagnostic_summary",
        "detailed_analysis",
        "patient_report",
        "clinician_report",
    ),
    "REPORT_STATUSES": ("pending", "generating", "completed", "degraded", "failed"),
    "NARRATIVE_SECTIONS": ("summary", "observations", "recommendations", "limitations"),
}

SET_NAMES = tuple(EXPECTED)


def _read(path: Path) -> str:
    if not path.exists():
        pytest.fail(f"{path.relative_to(REPO_ROOT)} does not exist yet (T019)")
    return path.read_text(encoding="utf-8")


def _python_contract():
    try:
        from app.contracts import report_contract
    except ImportError as exc:
        pytest.fail(f"backend/app/contracts/report_contract.py does not exist yet (T018): {exc}")
    return report_contract


def _ts_members(source: str, name: str) -> tuple:
    """The quoted literals of a `const NAME = [...] as const` array."""
    match = re.search(rf"\b{name}\b\s*(?::[^=]+)?=\s*\[(.*?)\]", source, re.DOTALL)
    if not match:
        pytest.fail(f"{name} is not declared as an array literal in contract.ts")
    return tuple(re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)))


def _ts_report_number_pattern(source: str) -> str:
    """Accepts either a regex literal or a string; T019 may write it either way."""
    match = re.search(
        r"\bREPORT_NUMBER_PATTERN\b\s*(?::[^=]+)?=\s*(?:/(.+?)/[a-z]*|['\"](.+?)['\"])",
        source,
    )
    if not match:
        pytest.fail("REPORT_NUMBER_PATTERN is not declared in contract.ts")
    return match.group(1) or match.group(2)


# --------------------------------------------------------------------------- #
# The two modules agree
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("name", SET_NAMES)
def test_closed_sets_match_across_the_language_boundary(name):
    ts_members = _ts_members(_read(CONTRACT_TS), name)
    py_members = tuple(getattr(_python_contract(), name))
    assert ts_members == py_members, f"{name}: contract.ts {ts_members} vs python {py_members}"


@pytest.mark.parametrize("name", SET_NAMES)
def test_closed_sets_match_the_written_contract(name):
    """Both modules could drift together; contract §1 is the third opinion."""
    assert tuple(getattr(_python_contract(), name)) == EXPECTED[name]


def test_report_number_pattern_matches_across_the_language_boundary():
    ts_pattern = _ts_report_number_pattern(_read(CONTRACT_TS))
    py_pattern = _python_contract().REPORT_NUMBER_PATTERN
    assert ts_pattern == py_pattern, f"contract.ts {ts_pattern!r} vs python {py_pattern!r}"


def test_report_number_pattern_is_the_one_the_database_enforces():
    """Migration 007's CHECK constraint. A looser pattern fails at insert time."""
    assert _python_contract().REPORT_NUMBER_PATTERN == r"^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$"


# --------------------------------------------------------------------------- #
# The report vocabulary is the one that gets spoken
# --------------------------------------------------------------------------- #

def _pending_report_members() -> tuple:
    source = DASHBOARD_SERVER_TS.read_text(encoding="utf-8")
    match = re.search(r"\bPENDING_REPORT\b\s*(?::[^=]+)?=\s*\[(.*?)\]", source, re.DOTALL)
    if not match:
        pytest.fail("PENDING_REPORT is not declared as an array literal in dashboard.server.ts")
    return tuple(re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)))


def test_pending_report_does_not_count_a_status_nothing_writes():
    members = _pending_report_members()
    assert "processing" not in members, (
        f"PENDING_REPORT = {list(members)}; nothing has ever written 'processing' "
        "to generated_reports.generation_status, so this count is always zero"
    )


def test_pending_report_speaks_only_report_statuses():
    statuses = tuple(_python_contract().REPORT_STATUSES)
    for member in _pending_report_members():
        assert member in statuses, f"{member!r} is not a REPORT_STATUS: {statuses}"


def test_no_report_route_mentions_processing():
    """[protect] the orchestrator and its read routes must not learn the word."""
    offenders = [
        path.relative_to(REPO_ROOT)
        for path in sorted(REPORT_ROUTES.rglob("*.ts"))
        if re.search(r"['\"]processing['\"]", path.read_text(encoding="utf-8"))
    ]
    assert not offenders, f"report routes use a status nothing writes: {offenders}"
