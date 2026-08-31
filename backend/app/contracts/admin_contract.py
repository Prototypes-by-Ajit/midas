"""The admin control room contract, Python half.

`frontend/src/lib/admin/contract.ts` is the other half and must hold the same
values in the same order. Nothing in this toolchain generates one from the other
-- there is no codegen step and CI verifies nothing -- so
`tests/test_admin_contract.py` reads the TypeScript file as **text** and asserts
the two agree, plus (for three of the four sets) that migration `016`'s `CHECK`
literals agree too. Change one, change both, in the same edit.

Source of truth:
`.specify/specs/003-admin-control-room/contracts/admin-control-room-contract.md` §1
and `data-model.md` §1-§2.
"""

# --------------------------------------------------------------------------- #
# Closed sets (contract §1). Membership is closed: a value outside a set is an
# error, never a substitution.
# --------------------------------------------------------------------------- #

# Every value `audit_events.action` can hold -- three governed actions plus six
# read-denial actions, one per admin route family (spec.md's Access Denial
# Logging pattern; speckit-analyze finding F1 closed the gap where only two of
# six route families had one). Kept open at the DB layer (no CHECK) since this
# MVP's own governed-action set may grow before the next migration cycle
# (data-model.md §1) -- TS/Python drift enforcement only, no third (DB) copy.
AUDIT_ACTIONS = (
    "user.invite",
    "user.role_change",
    "user.offboard",
    "audit.read.refused",
    "users.read.refused",
    "overview.read.refused",
    "health.read.refused",
    "rag.read.refused",
    "permissions.read.refused",
)

# Every value `audit_events.outcome` can hold. `pending` (eng review finding 1)
# is written before the external Clerk call a governed action makes, and
# reconciled to `allowed`/`refused` once that call and its RPC finalize complete
# -- the append-only trigger permits exactly this one transition (data-model.md
# §3). Never returned in a client-facing API response.
AUDIT_OUTCOMES = (
    "allowed",
    "refused",
    "pending",
)

# Every value `policy_block_events.classification` can hold -- derived from which
# `_oos()` branch fired in the chat safety guardrail (research.md R5), never from
# its free-text `reasoning` field.
POLICY_BLOCK_CLASSIFICATIONS = (
    "no_dermatology_keywords",
    "referential_without_context",
    "followup_new_topic",
    "classifier_fail_closed",
)

# The three roles this feature governs. Patient and clinician never reach here.
OPERATOR_ROLES = (
    "admin",
    "ml_engineer",
    "sre",
)
