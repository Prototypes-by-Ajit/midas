/**
 * The report contract, TypeScript half.
 *
 * `backend/app/contracts/report_contract.py` is the other half and holds the same
 * values in the same order. Nothing generates one from the other, so
 * `backend/tests/test_report_contract.py` reads this file as text and asserts they
 * agree. Change one, change both, in the same edit.
 *
 * Source of truth:
 * `.specify/specs/001-report-generation-integrity/contracts/report-contract.md`.
 */

// --------------------------------------------------------------------------- //
// Closed sets (contract §1). Membership is closed: a value outside a set is an
// error, never a substitution.
// --------------------------------------------------------------------------- //

export const REPORT_TYPES = [
  "diagnostic_summary",
  "detailed_analysis",
  "patient_report",
  "clinician_report",
] as const

export const REPORT_STATUSES = [
  "pending",
  "generating",
  "completed",
  "degraded",
  "failed",
] as const

export const NARRATIVE_SECTIONS = [
  "summary",
  "observations",
  "recommendations",
  "limitations",
] as const

// `processing` is deliberately absent. Nothing has ever written it; it survives
// only in `services/dashboard.server.ts`, and is removed there by T029.

export type ReportType = (typeof REPORT_TYPES)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]
export type NarrativeSection = (typeof NARRATIVE_SECTIONS)[number]

/** Terminal states never transition again (FR-041a). */
export const TERMINAL_STATUSES = ["completed", "degraded", "failed"] as const
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]

export type SectionsGenerated = Record<NarrativeSection, boolean>

/**
 * What the narrative generator produced, and what it did not.
 *
 * `degraded_reason === null` is what `completed` means; a non-null reason is what
 * `degraded` means. A historical row carries no provenance at all — that is
 * `null`, and it renders as "provenance unavailable", never as complete
 * (Assumption 2).
 */
export interface ReportProvenance {
  sections_generated: SectionsGenerated
  generator: string | null
  degraded_reason: string | null
}

// --------------------------------------------------------------------------- //
// Report number
// --------------------------------------------------------------------------- //

/** Migration 007's CHECK constraint. A looser pattern fails at insert time. */
export const REPORT_NUMBER_PATTERN = "^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$"

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const TOKEN_LENGTH = 6

/**
 * A report number the database will accept, every time.
 *
 * Replaces `Math.random().toString(36).slice(2, 8)`, which yields six characters
 * only when the float's base-36 expansion happens to be long enough — a short
 * expansion produced a number that violated the CHECK constraint at insert time
 * and surfaced as a 500 on someone who did nothing wrong. Drawing a fixed count
 * of characters removes the variable length entirely.
 *
 * `now` is injectable so the date half is testable without touching the clock.
 */
export function makeReportNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")

  let token = ""
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]
  }

  return `MIDAS-REP-${date}-${token}`
}

// --------------------------------------------------------------------------- //
// Timing (invariant: backend LLM ceiling 180s < abort < stale)
// --------------------------------------------------------------------------- //

/**
 * How long the orchestrator waits on the report service before giving up.
 *
 * Above the backend's own 180s LLM ceiling, so a slow-but-succeeding narrative is
 * never cut off by its own caller; below `REPORT_STALE_MS`, so the abort always
 * gets to write `failed` before the UI would call the row interrupted.
 */
export const REPORT_ABORT_MS = 240_000

/**
 * When a `generating` row is presented as *Didn't finish*.
 *
 * No transition exists when the observer dies mid-generation, so without a
 * read-time rule the row stays "Generating…" forever once history is durable.
 */
export const REPORT_STALE_MS = 300_000

// --------------------------------------------------------------------------- //
// Errors
// --------------------------------------------------------------------------- //

export interface ReportErrorBody {
  error: string
  code: string
  details?: string
}

/**
 * The contract §6 error envelope — the mirror of `error_body()` in
 * `backend/app/contracts/report_contract.py`, and the only shape either side emits.
 *
 * `details` is omitted rather than null when absent, so a consumer can test for
 * its presence. It MUST NOT carry credentials, another person's storage path, or
 * a raw upstream payload beyond a truncated excerpt — the caller decides what it
 * passes here.
 */
export function errorBody(code: string, message: string, details?: string): ReportErrorBody {
  return details === undefined ? { error: message, code } : { error: message, code, details }
}

/** A value crossed a closed-set boundary. Carries the machine code for §6. */
export class ReportContractError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "ReportContractError"
    this.code = code
  }
}

export function isReportType(value: unknown): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType)
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus)
}

export function isTerminalStatus(value: unknown): value is TerminalStatus {
  return TERMINAL_STATUSES.includes(value as TerminalStatus)
}
