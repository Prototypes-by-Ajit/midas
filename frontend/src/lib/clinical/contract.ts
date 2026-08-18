/**
 * The clinical review contract, TypeScript half.
 *
 * `backend/app/contracts/clinical_contract.py` is the other half and holds the
 * same values in the same order. Nothing generates one from the other, so
 * `backend/tests/test_clinical_contract.py` reads this file as text and asserts
 * they agree — and, once migration `015` exists, that the database's `CHECK`
 * literals agree too. Change one, change all of them, in the same edit.
 *
 * Source of truth:
 * `.specify/specs/002-three-view-clinical-pipeline/contracts/clinical-pipeline-contract.md` §1.
 *
 * This module deliberately declares no error envelope. `errorBody()` in
 * `@/lib/reports/contract` is the only shape either half of this system emits,
 * and a second one here would be a second contract (contract §2).
 */

// --------------------------------------------------------------------------- //
// Closed sets (contract §1). Membership is closed: a value outside a set is an
// error, never a substitution.
// --------------------------------------------------------------------------- //

/**
 * Where a case stands clinically — `medical_analyses.review_state`.
 *
 * A **third** vocabulary (spec A8). It does not extend, replace, or overlap
 * `medical_analyses.status` (did the model run?) or
 * `generated_reports.generation_status` (does a document exist?). A case reaches
 * `decided` regardless of whether a document exists yet.
 *
 * `NULL` is a fourth reading of the column and is **not a member**: the row
 * predates this feature. It renders as unknown and never enters a work list
 * (FR-044). Anything treating `NULL` as `awaiting_review` drops every historical
 * analysis into a live clinician queue.
 */
export const CASE_REVIEW_STATES = [
  "awaiting_review",
  "claimed",
  "more_data_requested",
  "decided",
  "signed",
  "released",
] as const

/**
 * The kind of action a clinician recorded — `case_reviews.outcome`.
 *
 * **Not clinical.** It records what was done, never a finding. Clinical content
 * is free text in `case_reviews.note`, authored by a clinician (Constitution II).
 */
export const REVIEW_OUTCOMES = ["decision_recorded", "more_data_requested"] as const

/** Where a single report version stands — `report_versions.state`. */
export const VERSION_STATES = ["draft", "signed", "superseded"] as const

export type CaseReviewState = (typeof CASE_REVIEW_STATES)[number]
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number]
export type VersionState = (typeof VERSION_STATES)[number]
