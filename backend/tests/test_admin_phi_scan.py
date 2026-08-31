"""T069 -- PHI-leakage scan for the Admin Control Room's read endpoints.

Verifies the Non-Goal every FR-* in 003-admin-control-room is built against
("no PHI display anywhere", spec.md Out of Scope): none of `admin.py`'s
handlers ever query `medical_analyses` (the one table that holds a patient's
diagnosis/confidence/recommendations) or select any of its PHI-bearing
columns from any table.

Static, offline source-text scan rather than the live-fixture check the task
text originally asked for (query a live server with a seeded
`medical_analyses` row, inspect the JSON for leakage). Substituted because
this is the stronger guarantee, cheaper to run, and needs no live database:
every one of `admin.py`'s Supabase queries is a literal `.table("...")` /
`.select("...")` call in this one file -- reading the source IS reading every
query this router can ever issue, not a sample of what a live request
happened to return. A future query built dynamically from a variable table
name would defeat this; none currently is (confirmed by the same read this
test automates).

`documents.lesion_class` (RAG ingestion queue, T029) is deliberately NOT
flagged -- it classifies a *reference document* in the knowledge base (e.g.
"which dermatology topic this article covers"), not a patient's own
diagnosis. `documents` and `medical_analyses` are different tables; only the
latter is PHI.
"""
from pathlib import Path

ADMIN_PY = Path(__file__).parent.parent / "app" / "api" / "admin.py"

# Columns that only ever carry a patient's own clinical result (AnalysisRecord,
# frontend/src/types/dashboard.ts) -- never legitimate on an admin/ops surface.
PHI_COLUMNS = ["diagnosis", "confidence", "recommendations", "risk_level"]


def _source() -> str:
    return ADMIN_PY.read_text()


def test_admin_router_never_queries_medical_analyses():
    source = _source()
    assert '"medical_analyses"' not in source and "'medical_analyses'" not in source, (
        "admin.py references the medical_analyses table -- the one table this "
        "feature's Non-Goal explicitly forbids reading from"
    )


def test_admin_router_never_selects_phi_columns():
    source = _source()
    hits = [col for col in PHI_COLUMNS if col in source]
    assert not hits, (
        f"admin.py's source contains PHI-bearing column name(s) {hits} -- "
        "verify these aren't a leaked medical_analyses select before allowing this"
    )


def test_admin_router_table_names_are_the_expected_allowlist():
    """Positive-list check, not just a negative one -- every `.table("...")`
    call in this file must be one of the tables this feature actually adds or
    already-safely reads (data-model.md), so a new table reference gets
    reviewed here rather than silently passing the two checks above."""
    import re

    source = _source()
    tables = set(re.findall(r'\.table\(["\']([a-z_]+)["\']\)', source))
    allowed = {"audit_events", "policy_block_events", "documents", "embeddings"}
    assert tables <= allowed, f"admin.py queries table(s) outside the reviewed allowlist: {tables - allowed}"
    assert tables, "no .table(...) calls found at all -- this test would pass vacuously if admin.py's queries changed shape; update the regex"
