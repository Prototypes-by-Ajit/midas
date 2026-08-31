/**
 * The admin control room contract, TypeScript half.
 *
 * `backend/app/contracts/admin_contract.py` is the other half and holds the same
 * values in the same order. Nothing generates one from the other, so
 * `backend/tests/test_admin_contract.py` reads this file as text and asserts they
 * agree — and, for three of the four sets, that the database's `CHECK` literals
 * agree too, once migration `016` exists. Change one, change all of them, in the
 * same edit.
 *
 * Source of truth:
 * `.specify/specs/003-admin-control-room/contracts/admin-control-room-contract.md` §1.
 *
 * `AUDIT_ACTIONS` is the one set with no database `CHECK` — kept open at the DB
 * layer (data-model.md §1) since this MVP's own governed-action set may grow
 * before the next migration cycle. It still gets TypeScript↔Python drift
 * enforcement; it just has no third (DB) copy to compare against.
 */

// --------------------------------------------------------------------------- //
// Closed sets (contract §1). Membership is closed: a value outside a set is an
// error, never a substitution.
// --------------------------------------------------------------------------- //

/**
 * Every value `audit_events.action` can hold — three governed actions plus six
 * read-denial actions, one per admin route family (spec.md's Access Denial
 * Logging pattern; speckit-analyze finding F1 closed the gap where only two of
 * six route families had one).
 */
export const AUDIT_ACTIONS = [
  "user.invite",
  "user.role_change",
  "user.offboard",
  "audit.read.refused",
  "users.read.refused",
  "overview.read.refused",
  "health.read.refused",
  "rag.read.refused",
  "permissions.read.refused",
] as const

/**
 * Every value `audit_events.outcome` can hold.
 *
 * `pending` (eng review finding 1) is written before the external Clerk call a
 * governed action makes, and reconciled to `allowed`/`refused` once that call and
 * its RPC finalize complete — the append-only trigger permits exactly this one
 * transition (data-model.md §3). It is never returned in a client-facing API
 * response, only ever an internal reconciliation state.
 */
export const AUDIT_OUTCOMES = ["allowed", "refused", "pending"] as const

/**
 * Every value `policy_block_events.classification` can hold — derived from which
 * `_oos()` branch fired in the chat safety guardrail (research.md R5), never from
 * its free-text `reasoning` field.
 */
export const POLICY_BLOCK_CLASSIFICATIONS = [
  "no_dermatology_keywords",
  "referential_without_context",
  "followup_new_topic",
  "classifier_fail_closed",
] as const

/**
 * The one role this feature governs. Patient and clinician never reach here.
 * ml_engineer/sre were collapsed into admin (2026-08-31) — see
 * role-based-sidebar.tsx and admin.py's OPERATOR_ROLES for the same change.
 */
export const OPERATOR_ROLES = ["admin"] as const
/** The three roles this feature governs. Patient and clinician never reach here. */
export const OPERATOR_ROLES = ["admin", "ml_engineer", "sre"] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number]
export type PolicyBlockClassification = (typeof POLICY_BLOCK_CLASSIFICATIONS)[number]
export type OperatorRole = (typeof OPERATOR_ROLES)[number]
