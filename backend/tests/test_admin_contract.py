"""T004/T005 -- the two admin contract modules must agree, across the language boundary.

Modelled on `test_clinical_contract.py`, for the same reason it exists: nothing else
in this toolchain can detect drift between
`frontend/src/lib/admin/contract.ts` and
`backend/app/contracts/admin_contract.py`. There is no codegen step, no shared
schema, and no CI that builds either side (`.github/workflows/ci.yml` only echoes).
So the TypeScript module is read as **text** -- no build, no node, no import -- and
its literals are compared with the Python module's (contract §1, "Drift
enforcement").

`EXPECTED` names every literal a third time, independently of both modules, so a
drift in *both* halves at once still fails.

Unlike the clinical contract, only **two** of the four sets have a database `CHECK`
to compare against, for two different reasons (plan.md's Constitution Check §IV,
corrected twice on 2026-08-30 by speckit-analyze finding F6):

  - `AUDIT_ACTIONS` -- deliberately kept open at the DB layer (data-model.md §1);
    this MVP's own governed-action set may grow before the next migration cycle.
  - `OPERATOR_ROLES` -- has no database column at all. Role lives in Clerk
    `privateMetadata`/`publicMetadata`, a JSON blob (data-model.md §6), never a
    Postgres column this migration touches.

So `AUDIT_OUTCOMES` and `POLICY_BLOCK_CLASSIFICATIONS` get three-way
(TS/Python/DB) drift enforcement; `AUDIT_ACTIONS` and `OPERATOR_ROLES` get
TS/Python only. Asserting a DB `CHECK` for either of the latter two would fail
against a migration that correctly implements the design -- that would be testing
the wrong thing, not tightening the guarantee.

Before migration 016 exists (Phase 3), the DB-comparison tests below are EXPECTED
to fail -- quickstart.md §1 says so explicitly ("Run it -- it must fail"). Re-run
after Phase 3 lands; T014 is that re-run.
"""

import re
from pathlib import Path

import pytest

# tests/ -> backend/ -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]

CONTRACT_TS = REPO_ROOT / "frontend/src/lib/admin/contract.ts"
MIGRATION = REPO_ROOT / "supabase/migrations/016_admin_control_room.sql"

# Contract §1, named independently of both modules so a drift in both at once
# still fails.
EXPECTED = {
    "AUDIT_ACTIONS": (
        "user.invite",
        "user.role_change",
        "user.offboard",
        "audit.read.refused",
        "users.read.refused",
        "overview.read.refused",
        "health.read.refused",
        "rag.read.refused",
        "permissions.read.refused",
    ),
    "AUDIT_OUTCOMES": ("allowed", "refused", "pending"),
    "POLICY_BLOCK_CLASSIFICATIONS": (
        "no_dermatology_keywords",
        "referential_without_context",
        "followup_new_topic",
        "classifier_fail_closed",
    ),
    "OPERATOR_ROLES": ("admin", "ml_engineer", "sre"),
}

SET_NAMES = tuple(EXPECTED)

# Which sets have a DB `CHECK` to compare against, and which column carries it.
# AUDIT_ACTIONS and OPERATOR_ROLES are absent from this map on purpose (see the
# module docstring) -- looking one up with .get() and skipping is the intended
# behaviour, not a gap.
DB_CHECKED_SETS = {
    "AUDIT_OUTCOMES": "outcome",
    "POLICY_BLOCK_CLASSIFICATIONS": "classification",
}


def _read(path: Path) -> str:
    if not path.exists():
        pytest.fail(f"{path.relative_to(REPO_ROOT)} does not exist yet")
    return path.read_text(encoding="utf-8")


def _python_contract():
    try:
        from app.contracts import admin_contract
    except ImportError as exc:
        pytest.fail(f"backend/app/contracts/admin_contract.py does not exist yet: {exc}")
    return admin_contract


def _ts_members(source: str, name: str) -> tuple:
    """The quoted literals of an `export const NAME = [...] as const` array."""
    match = re.search(rf"\b{name}\b\s*(?::[^=]+)?=\s*\[(.*?)\]", source, re.DOTALL)
    if not match:
        pytest.fail(f"{name} is not declared as an array literal in admin/contract.ts")
    return tuple(re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)))


def _check_members(sql: str, column: str) -> tuple:
    """The quoted literals of `CHECK (<column> IN (...))` in migration 016."""
    match = re.search(rf"CHECK\s*\(\s*\b{column}\s+IN\s*\((.*?)\)", sql, re.DOTALL | re.IGNORECASE)
    if not match:
        pytest.fail(f"migration 016 declares no `CHECK ({column} IN (...))`")
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


# --------------------------------------------------------------------------- #
# The two modules agree
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("name", SET_NAMES)
def test_closed_sets_match_across_the_language_boundary(name):
    ts_members = _ts_members(_read(CONTRACT_TS), name)
    py_members = tuple(getattr(_python_contract(), name))
    assert ts_members == py_members, f"{name}: admin/contract.ts {ts_members} vs python {py_members}"


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
    assert match, f"{name} is not declared `as const` in admin/contract.ts"


# --------------------------------------------------------------------------- #
# The two DB-backed sets also agree with migration 016. Expected to fail until
# Phase 3 lands (quickstart.md §1) -- that failure is this test working, not this
# test being broken.
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("name", sorted(DB_CHECKED_SETS))
def test_migration_check_literals_match_both_language_halves(name):
    sql_members = _check_members(_read(MIGRATION), DB_CHECKED_SETS[name])
    py_members = tuple(getattr(_python_contract(), name))
    ts_members = _ts_members(_read(CONTRACT_TS), name)

    assert sql_members == py_members, f"{name}: migration 016 {sql_members} vs python {py_members}"
    assert sql_members == ts_members, f"{name}: migration 016 {sql_members} vs admin/contract.ts {ts_members}"
    assert sql_members == EXPECTED[name]


def test_audit_actions_has_no_db_check_by_design():
    """Negative check, guarding the design decision itself (data-model.md §1): if a
    future migration edit adds a CHECK on `action`, this vocabulary's growth stops
    being cheap and the design note in data-model.md §1 needs updating to match --
    this test is what notices the mismatch instead of it going unnoticed."""
    sql = _read(MIGRATION)
    match = re.search(r"CHECK\s*\(\s*\baction\s+IN\s*\(", sql, re.IGNORECASE)
    assert match is None, (
        "migration 016 now CHECK-constrains `action`, but data-model.md §1 and this "
        "test both assume it stays open for growth -- update the design note (and "
        "this test) if that constraint is now intentional"
    )


def test_operator_roles_is_not_a_migration_column():
    """Negative check: OPERATOR_ROLES must never gain a DB_CHECKED_SETS entry by
    accident, because role is Clerk metadata, not a Postgres column (data-model.md
    §6) -- there is no `role` column in this migration to constrain."""
    assert "OPERATOR_ROLES" not in DB_CHECKED_SETS
