"""The clinical review contract, Python half.

`frontend/src/lib/clinical/contract.ts` is the other half and must hold the same
values in the same order. Nothing in this toolchain generates one from the other
-- there is no codegen step and CI verifies nothing -- so
`tests/test_clinical_contract.py` reads the TypeScript file as **text** and
asserts the two agree. Change one, change both, in the same edit.

Source of truth:
`.specify/specs/002-three-view-clinical-pipeline/contracts/clinical-pipeline-contract.md` §1
and `data-model.md` §6.
"""

# --------------------------------------------------------------------------- #
# Closed sets (contract §1). Membership is closed: a value outside a set is an
# error, never a substitution.
# --------------------------------------------------------------------------- #

# Where a case stands clinically -- `medical_analyses.review_state`.
#
# A *third* vocabulary (spec A8), overlapping neither `medical_analyses.status`
# (did the model run?) nor `generated_reports.generation_status` (does a document
# exist?).
#
# `NULL` is a fourth reading of the column and is NOT a member: the row predates
# this feature. It renders as unknown and never enters a work list (FR-044).
CASE_REVIEW_STATES = (
    "awaiting_review",
    "claimed",
    "more_data_requested",
    "decided",
    "signed",
    "released",
)

# The kind of action a clinician recorded -- `case_reviews.outcome`. Not clinical:
# it records what was done, never a finding. Clinical content is free text in
# `case_reviews.note`, authored by a clinician (Constitution II).
REVIEW_OUTCOMES = (
    "decision_recorded",
    "more_data_requested",
)

# Where a single report version stands -- `report_versions.state`.
VERSION_STATES = (
    "draft",
    "signed",
    "superseded",
)

# --------------------------------------------------------------------------- #
# State machine (data-model.md §6), mirrored exactly as `report_contract.py`'s
# `ALLOWED_TRANSITIONS` does. An edge absent here is a 422 `INVALID_TRANSITION`.
# --------------------------------------------------------------------------- #

ALLOWED_CASE_TRANSITIONS = frozenset(
    {
        ("awaiting_review", "claimed"),
        ("claimed", "decided"),
        ("claimed", "more_data_requested"),
        # D5 supersedes data-model.md §6's inline "returns unclaimed" comment:
        # `claimed_by` SURVIVES this edge. The case returns to the claiming
        # clinician's own list, not the shared pool -- continuity of care, the
        # clinician who asked the question sees the answer (FR-007).
        ("more_data_requested", "awaiting_review"),
        ("decided", "signed"),
        ("signed", "released"),
        # The correction path, and the only edge that looks backwards (FR-022).
        # The *case* returns to `signed` while the previously released version
        # stays released and readable (FR-029) -- which is why release is a fact
        # on the version, not only a state on the case.
        ("released", "signed"),
    }
)

# Seven edges, not eight. Task T004 says "the eight edges in data-model.md §6";
# §6 declares seven, and §6 is the source T004 names. Widening a clinical state
# machine's legal surface to satisfy a count is the wrong direction, so the seven
# that exist are the seven encoded here. Flagged for an owner decision; if an
# eighth edge is intended it needs to be written into §6 first.

# No edge leaves `released` except back to `signed`. There is no terminal state:
# a released case can always be corrected.
