"""T005 -- the two clinical contract modules must agree, across the language boundary.

Modelled on `test_report_contract.py`, for the same reason it exists: nothing else
in this toolchain can detect drift between
`frontend/src/lib/clinical/contract.ts` and
`backend/app/contracts/clinical_contract.py`. There is no codegen step, no shared
schema, and no CI that builds either side (`.github/workflows/ci.yml` only echoes).
So the TypeScript module is read as **text** -- no build, no node, no import -- and
its literals are compared with the Python module's (contract §1, "Drift
enforcement").

`EXPECTED` names every literal a third time, independently of both modules, so a
drift in *both* halves at once still fails. Two modules edited together are not
two opinions; the written contract is the third.

T013 (done) extends this file to read migration `015`'s `CHECK` literals and its
`plpgsql` function bodies, so the vocabulary is asserted across **four** sources:

    1. frontend/src/lib/clinical/contract.ts        (read as text)
    2. backend/app/contracts/clinical_contract.py   (imported)
    3. supabase/migrations/015_*.sql  CHECK clauses (read as text)
    4. the same migration's plpgsql function bodies (read as text)

plus `EXPECTED` below, which is the written contract stating all of it a fifth
time. The fourth source exists because D3 moved the multi-write paths into
`plpgsql`; a state literal inside a function body is a copy of the vocabulary
that no compiler, linter, or type checker in this repo can see (review note E6).
Changing only the SQL fails here.
"""

import re
from pathlib import Path

import pytest

# tests/ -> backend/ -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]

CONTRACT_TS = REPO_ROOT / "frontend/src/lib/clinical/contract.ts"
MIGRATION = REPO_ROOT / "supabase/migrations/015_clinical_review_pipeline.sql"

# Which CHECK constraint in `015` carries which set. The column name is the key:
# `review_state in (...)`, `outcome in (...)`, `state in (...)`.
CHECK_COLUMN = {
    "CASE_REVIEW_STATES": "review_state",
    "REVIEW_OUTCOMES": "outcome",
    "VERSION_STATES": "state",
}

# Contract §1. Named here so a drift in *both* modules at once still fails.
EXPECTED = {
    "CASE_REVIEW_STATES": (
        "awaiting_review",
        "claimed",
        "more_data_requested",
        "decided",
        "signed",
        "released",
    ),
    "REVIEW_OUTCOMES": ("decision_recorded", "more_data_requested"),
    "VERSION_STATES": ("draft", "signed", "superseded"),
}

SET_NAMES = tuple(EXPECTED)

# data-model.md §6, named independently of the Python module for the same reason.
# Seven edges. T004's task text says eight; §6 -- the source T004 names -- declares
# these seven. This test is where that stays honest: adding an eighth edge to the
# module without writing it into §6 first fails here.
EXPECTED_TRANSITIONS = frozenset(
    {
        ("awaiting_review", "claimed"),
        ("claimed", "decided"),
        ("claimed", "more_data_requested"),
        ("more_data_requested", "awaiting_review"),
        ("decided", "signed"),
        ("signed", "released"),
        ("released", "signed"),
    }
)


def _read(path: Path) -> str:
    if not path.exists():
        pytest.fail(f"{path.relative_to(REPO_ROOT)} does not exist yet (T003)")
    return path.read_text(encoding="utf-8")


def _python_contract():
    try:
        from app.contracts import clinical_contract
    except ImportError as exc:
        pytest.fail(
            f"backend/app/contracts/clinical_contract.py does not exist yet (T004): {exc}"
        )
    return clinical_contract


def _ts_members(source: str, name: str) -> tuple:
    """The quoted literals of an `export const NAME = [...] as const` array."""
    match = re.search(rf"\b{name}\b\s*(?::[^=]+)?=\s*\[(.*?)\]", source, re.DOTALL)
    if not match:
        pytest.fail(f"{name} is not declared as an array literal in clinical/contract.ts")
    return tuple(re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)))


def _check_members(sql: str, column: str) -> tuple:
    """The quoted literals of `check (<column> in (...))` in migration 015.

    `\\b` before the column name is what keeps `state` from matching inside
    `review_state`: the character before `state` there is `_`, which is a word
    character, so no boundary exists.
    """
    match = re.search(rf"check\s*\(\s*\b{column}\s+in\s*\((.*?)\)", sql, re.DOTALL)
    if not match:
        pytest.fail(f"migration 015 declares no `check ({column} in (...))`")
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


def _plpgsql_bodies(sql: str) -> str:
    """Everything between `as $$` and the matching `$$` — the fourth source.

    Non-greedy because the delimiters pair and never nest in this file.
    """
    bodies = re.findall(r"as\s*\$\$(.*?)\$\$", sql, re.DOTALL)
    if not bodies:
        pytest.fail("migration 015 declares no $$-quoted function body")
    return "\n".join(bodies)


def _vocabulary_literals(text: str) -> set:
    """Single-quoted lower-snake-case tokens: the shape every vocabulary member has.

    Prose is excluded by construction — a `raise exception` message contains
    spaces and `%`, so it can never match — which is what keeps this check from
    needing an allowlist that would grow until it excused the next drift.
    """
    return {t for t in re.findall(r"'([^']*)'", text) if re.fullmatch(r"[a-z_]+", t)}


# --------------------------------------------------------------------------- #
# The two modules agree
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("name", SET_NAMES)
def test_closed_sets_match_across_the_language_boundary(name):
    ts_members = _ts_members(_read(CONTRACT_TS), name)
    py_members = tuple(getattr(_python_contract(), name))
    assert ts_members == py_members, (
        f"{name}: clinical/contract.ts {ts_members} vs python {py_members}"
    )


@pytest.mark.parametrize("name", SET_NAMES)
def test_closed_sets_match_the_written_contract(name):
    """Both modules could drift together; contract §1 is the third opinion."""
    assert tuple(getattr(_python_contract(), name)) == EXPECTED[name]


@pytest.mark.parametrize("name", SET_NAMES)
def test_ts_declares_each_set_as_const(name):
    """`as const` is what makes the derived type a union of literals rather than
    `string[]`. Without it the TypeScript half type-checks values it should refuse."""
    source = _read(CONTRACT_TS)
    match = re.search(rf"\b{name}\b\s*(?::[^=]+)?=\s*\[.*?\]\s*as const", source, re.DOTALL)
    assert match, f"{name} is not declared `as const` in clinical/contract.ts"


# --------------------------------------------------------------------------- #
# The state machine is the one data-model.md §6 declares
# --------------------------------------------------------------------------- #

def test_allowed_transitions_match_the_written_contract():
    assert _python_contract().ALLOWED_CASE_TRANSITIONS == EXPECTED_TRANSITIONS


def test_every_transition_endpoint_is_a_declared_state():
    """An edge naming a state outside the closed set is unreachable by construction
    and silently disables whatever it was meant to permit."""
    states = set(_python_contract().CASE_REVIEW_STATES)
    for source, target in _python_contract().ALLOWED_CASE_TRANSITIONS:
        assert source in states, f"{source!r} is not a CASE_REVIEW_STATE: {sorted(states)}"
        assert target in states, f"{target!r} is not a CASE_REVIEW_STATE: {sorted(states)}"


def test_null_is_not_a_member_of_the_state_vocabulary():
    """`NULL` means the row predates this feature: unknown, excluded from every work
    list (FR-044). Admitting it as a value is how historical analyses end up in a
    live clinician queue."""
    members = _python_contract().CASE_REVIEW_STATES
    for forbidden in ("null", "NULL", "unknown", "none", ""):
        assert forbidden not in members, f"{forbidden!r} must not be a CASE_REVIEW_STATE"


# --------------------------------------------------------------------------- #
# The clinical vocabulary is its own -- spec A8
# --------------------------------------------------------------------------- #

def test_clinical_contract_does_not_redeclare_the_report_vocabulary():
    """`CASE_REVIEW_STATES` is a third vocabulary. If it ever contains a
    `REPORT_STATUSES` member, the two have started to merge and a reader can no
    longer tell whether a state answers "does a document exist" or "where does this
    case stand"."""
    from app.contracts import report_contract

    overlap = set(_python_contract().CASE_REVIEW_STATES) & set(report_contract.REPORT_STATUSES)
    assert not overlap, f"clinical and report vocabularies overlap: {sorted(overlap)}"


# --------------------------------------------------------------------------- #
# T013 -- sources three and four: migration 015's CHECK clauses and the plpgsql
# bodies D3 introduced. Without these, the schema and the functions that write to
# it can drift from the code that reads it, and nothing notices until a clinician
# records a decision the database refuses.
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("name", SET_NAMES)
def test_migration_check_literals_match_both_language_halves(name):
    """Source three: `check (<column> in (...))` in `015`."""
    sql_members = _check_members(_read(MIGRATION), CHECK_COLUMN[name])
    py_members = tuple(getattr(_python_contract(), name))
    ts_members = _ts_members(_read(CONTRACT_TS), name)

    assert sql_members == py_members, (
        f"{name}: migration 015 {sql_members} vs python {py_members}"
    )
    assert sql_members == ts_members, (
        f"{name}: migration 015 {sql_members} vs clinical/contract.ts {ts_members}"
    )
    assert sql_members == EXPECTED[name]


def test_plpgsql_bodies_use_no_literal_outside_the_vocabulary():
    """Source four, and the direction that matters most.

    A `plpgsql` body that writes `'decided'` when the vocabulary has moved on to
    something else is a silent no-op: the `update` matches no row, the function
    raises its own not-found message, and the failure reads as a state-machine
    problem rather than as drift. Every lower-snake-case literal in these bodies
    must therefore be a member of one of the three sets.
    """
    vocabulary = set().union(*(set(v) for v in EXPECTED.values()))
    used = _vocabulary_literals(_plpgsql_bodies(_read(MIGRATION)))

    stray = used - vocabulary
    assert not stray, (
        f"migration 015's plpgsql bodies use {sorted(stray)}, which no vocabulary declares. "
        f"Either the literal is a typo, or the set was renamed in the other three sources only."
    )


@pytest.mark.parametrize("name", SET_NAMES)
def test_plpgsql_bodies_reference_each_vocabulary(name):
    """The subset check above passes vacuously if the bodies stop using the
    vocabulary at all -- which is exactly what deleting a state transition looks
    like. Each set must still be reachable from the functions that move a case."""
    used = _vocabulary_literals(_plpgsql_bodies(_read(MIGRATION)))
    assert used & set(EXPECTED[name]), (
        f"no member of {name} appears in any plpgsql body in migration 015"
    )


def test_migration_leaves_historical_rows_unchecked():
    """FR-044 at the schema layer. A validated constraint on `review_state` would
    force every pre-015 row to hold a member of the set, and the only way to
    satisfy that is a backfill -- which drops every historical analysis into a live
    clinician queue. `NOT VALID` is what keeps them NULL."""
    sql = _read(MIGRATION)
    match = re.search(
        r"add constraint medical_analyses_review_state_check(.*?);", sql, re.DOTALL
    )
    assert match, "015 does not add medical_analyses_review_state_check"
    assert "NOT VALID" in match.group(1).upper(), (
        "medical_analyses_review_state_check is validated; historical rows would have "
        "to be backfilled to satisfy it (FR-044)"
    )


def test_migration_never_defaults_the_review_columns():
    """A default on `review_state` asserts that every analysis recorded before this
    feature is awaiting a clinician. No such record exists (FR-044)."""
    sql = _read(MIGRATION)
    match = re.search(
        r"alter table public\.medical_analyses\s*\n\s*add column.*?;", sql, re.DOTALL
    )
    assert match, "015 does not add the three review columns to medical_analyses"
    assert "default" not in match.group(0).lower(), (
        "a review column carries a DEFAULT; historical rows must read NULL, not a state"
    )
