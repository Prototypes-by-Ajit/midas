/**
 * How a case reads, per role. Data and pure functions only — no JSX.
 *
 * One state machine, three renderings (FR-040). The table is the whole point:
 * three surfaces that each write their own copy will describe the same state
 * three incompatible ways, and the one that matters — what a patient is told
 * while a clinician is still reading their case — is the one nobody reviews.
 *
 * Follows `data/reports/status-presentation.ts` in shape and in voice: plain,
 * second person, says what you can do, never blames.
 *
 * ---------------------------------------------------------------------------
 * TWO TABLES, BECAUSE "FIFTEEN CELLS" NAMES TWO DIFFERENT THINGS.
 *
 * FR-040 and SC-005 say fifteen cells and mean five **shared view states** —
 * loading, empty, error, denied, no result — across three roles. `plan.md` prints
 * exactly that table.
 *
 * Task T032 specifies the type `Record<UserRole, Record<CaseReviewState,
 * Presentation>>`, which is six **clinical states** across three roles, and is
 * therefore eighteen. `plan.md` writes per-state copy for those separately, under
 * "Per-state copy for the clinical states themselves".
 *
 * They are both real and neither substitutes for the other: a surface needs to
 * know what to render while loading *and* what to say once a case turns out to be
 * `more_data_requested`. Both live here. **The spec should say fifteen shared
 * cells and eighteen clinical cells rather than one number covering both.**
 * ---------------------------------------------------------------------------
 */

import type { StatusTone } from "@/components/clinical/status-badge"
import type { CaseReviewState } from "@/lib/clinical/contract"
import type { UserRole } from "@/contexts/role-context"

/**
 * Type-only imports throughout, so this module has no runtime dependency on a
 * component or on the client-side role context. It is plain data that vitest can
 * import in a node environment, which is what makes T033 a unit test rather than
 * a render test.
 */
export interface Presentation {
  /** Short, badge-sized. Carries the meaning on its own with colour stripped (FR-041). */
  label: string
  /** The sentence a person reads. Never a score, never a risk word on a patient surface. */
  description: string
  tone: StatusTone
}

export const USER_ROLES = ["patient", "clinician", "admin"] as const

// --------------------------------------------------------------------------- //
// Table A — the five shared view states (FR-040, SC-005). Fifteen cells.
// --------------------------------------------------------------------------- //

/**
 * The states every surface has regardless of what the data says.
 *
 * `no_result` is a *valid outcome*, not an error, and its tone is deliberately
 * not `critical` in any of the three cells. E2 reframed this from "abstained":
 * the CNN never declines, so what this actually covers is `status = 'failed'` or
 * a null diagnosis. Routing it through an error state would tell a patient their
 * case broke when what happened is that a human now has to look at it (FR-042).
 */
export const SHARED_VIEW_STATES = ["loading", "empty", "error", "denied", "no_result"] as const
export type SharedViewState = (typeof SHARED_VIEW_STATES)[number]

export const SHARED_STATE_PRESENTATION: Record<
  UserRole,
  Record<SharedViewState, Presentation>
> = {
  patient: {
    loading: {
      label: "Loading",
      // The skeleton reserves the status card's final height. An island that
      // pops in against zero reserved space shifts the page under a reader.
      description: "Loading your case.",
      tone: "neutral",
    },
    empty: {
      label: "Nothing yet",
      description: "You haven't submitted an analysis yet.",
      tone: "neutral",
    },
    error: {
      label: "Couldn't load",
      description: "We couldn't load this right now. Nothing has changed on your end.",
      tone: "warning",
    },
    denied: {
      // Identical wording whether or not the case exists — the surface must not
      // answer the existence question the API refuses to answer (FR-031).
      label: "Not available",
      description: "You do not have access to this case.",
      tone: "neutral",
    },
    no_result: {
      label: "Being reviewed",
      description: "The automated step didn't produce a result. A clinician is reviewing your case.",
      tone: "neutral",
    },
  },

  clinician: {
    loading: {
      label: "Loading",
      description: "Loading the work list.",
      tone: "neutral",
    },
    empty: {
      label: "Queue clear",
      description: "Your queue is clear.",
      tone: "success",
    },
    error: {
      label: "Couldn't load",
      description: "We couldn't load this right now. Nothing has changed on your end. Try again.",
      tone: "warning",
    },
    denied: {
      label: "Not available",
      description: "You do not have access to this case.",
      tone: "neutral",
    },
    no_result: {
      label: "Needs your judgement",
      description: "No model result — needs your judgement.",
      tone: "warning",
    },
  },

  admin: {
    loading: {
      label: "Loading",
      description: "Loading the operational record.",
      tone: "neutral",
    },
    empty: {
      label: "No cases",
      description: "No cases recorded yet.",
      tone: "neutral",
    },
    error: {
      label: "Couldn't load",
      description: "We couldn't load this right now. Nothing has changed on your end. Try again.",
      tone: "warning",
    },
    denied: {
      label: "Not available",
      description: "You do not have access to this case.",
      tone: "neutral",
    },
    no_result: {
      label: "No result recorded",
      // The reason is appended by the caller from `error_message` — the admin is
      // the one role entitled to it, and it is operational rather than clinical.
      description: "No result recorded.",
      tone: "neutral",
    },
  },

}

// --------------------------------------------------------------------------- //
// Table B — the six clinical states (contract §1). Eighteen cells.
// --------------------------------------------------------------------------- //

/**
 * `plan.md` writes the patient copy for `awaiting_review`, `more_data_requested`
 * and `released` verbatim, and those three are quoted exactly. The other fifteen
 * cells are **authored here** in the same voice, because no artifact wrote them.
 *
 * The patient column never carries a score, a percentage, or a risk word in any
 * state (SC-010). A patient reading their own case before release must not be
 * able to state what the machine predicted, and the fastest way to break that is
 * a status line that says "high risk — under review".
 */
export const CASE_STATE_PRESENTATION: Record<
  UserRole,
  Record<CaseReviewState, Presentation>
> = {
  patient: {
    awaiting_review: {
      label: "Waiting for a clinician",
      description: "A clinician will review this. We'll let you know when your report is ready.",
      tone: "neutral",
    },
    claimed: {
      // Deliberately not "claimed" — the word describes the clinician's workflow,
      // not anything the patient can act on or needs to understand.
      label: "Being reviewed",
      description: "A clinician is reviewing your case now.",
      tone: "active",
    },
    more_data_requested: {
      label: "More information needed",
      // The ask itself is the primary content, verbatim from `case_reviews.note`,
      // and the caller renders it — not as a badge. This is the fallback line for
      // when the note is missing.
      description: "A clinician has asked you for more information.",
      tone: "warning",
    },
    decided: {
      label: "Report being prepared",
      description: "A clinician has reviewed your case. Your report is being prepared.",
      tone: "active",
    },
    signed: {
      // Signature is not the patient-visibility gate; release is (FR-026). This
      // cell must not imply the document is readable yet.
      label: "Almost ready",
      description: "A clinician has completed your report. It will appear here once it's released.",
      tone: "active",
    },
    released: {
      label: "Ready",
      description: "Your report is ready to read.",
      tone: "success",
    },
  },

  clinician: {
    awaiting_review: {
      label: "Unclaimed",
      description: "Waiting for a clinician. Anyone on the team can pick this up.",
      tone: "warning",
    },
    claimed: {
      label: "Yours",
      description: "You're holding this case. No one else can act on it.",
      tone: "active",
    },
    more_data_requested: {
      // D5: the claim survives this transition. The case comes back to the
      // clinician who asked the question, not to the shared pool — so this cell
      // says "your list", which is the continuity-of-care promise in one word.
      label: "Waiting on the patient",
      description: "You asked for more information. This case stays on your list.",
      tone: "warning",
    },
    decided: {
      label: "Decision recorded",
      description: "Your decision is recorded. Version 1 is ready for you to sign.",
      tone: "active",
    },
    signed: {
      label: "Signed",
      description: "Signed and not yet released. The patient cannot see it until you release it.",
      tone: "active",
    },
    released: {
      label: "Released",
      description: "The patient can read this version.",
      tone: "success",
    },
  },

  admin: {
    awaiting_review: {
      label: "Awaiting review",
      description: "In the queue, unclaimed.",
      tone: "warning",
    },
    claimed: {
      label: "Claimed",
      description: "A clinician is holding this case.",
      tone: "active",
    },
    more_data_requested: {
      label: "More data requested",
      description: "Returned to the claiming clinician's own list, still held.",
      tone: "warning",
    },
    decided: {
      label: "Decided",
      description: "A decision is recorded. No signature yet.",
      tone: "active",
    },
    signed: {
      label: "Signed",
      description: "Signed, not released.",
      tone: "active",
    },
    released: {
      label: "Released",
      description: "Released to the patient.",
      tone: "success",
    },
  },

}

// --------------------------------------------------------------------------- //
// Lookups
// --------------------------------------------------------------------------- //

/**
 * The clinical state as this role should see it.
 *
 * **Returns `null` for a patient whose `review_state` is `NULL` (G3).** The
 * caller renders nothing at all: no badge, no review section, no change from
 * before this feature. The case never entered the pipeline, so there is nothing
 * truthful to say about its review — and "unknown" printed on a medical result
 * reads as a fault to the person it is about.
 *
 * Clinician and admin keep *unknown*, where the distinction is operationally
 * real: a case with no review state is one their queue has never seen.
 *
 * A state outside the closed set is displayed verbatim and never rewritten,
 * following `presentStatus()`. A historical row is not evidence that the
 * vocabulary is wrong; it is evidence the row predates it.
 */
export function presentCaseState(
  role: UserRole,
  state: string | null | undefined,
): Presentation | null {
  if (state === null || state === undefined) {
    if (role === "patient") return null
    return {
      label: "Unknown",
      description: "This case predates clinical review. It has never entered the queue.",
      tone: "neutral",
    }
  }

  const known = CASE_STATE_PRESENTATION[role][state as CaseReviewState]
  if (known) return known

  return {
    label: state,
    description: "This case carries a review state outside the current vocabulary.",
    tone: "neutral",
  }
}

/** One of the five shared view states, for this role. */
export function presentSharedState(role: UserRole, state: SharedViewState): Presentation {
  return SHARED_STATE_PRESENTATION[role][state]
}

/**
 * Whether an analysis produced a usable result.
 *
 * The `no_result` cell of Table A, decided at read time from what the inference
 * actually left behind — there is no stored flag, because E2 established the CNN
 * never declines. `status = 'failed'` or a null diagnosis is the whole of it.
 */
export function hasNoUsableResult(analysis: {
  status?: string | null
  diagnosis?: string | null
}): boolean {
  return analysis.status === "failed" || !analysis.diagnosis
}

/**
 * How long a case has been waiting, as a clinician reads it.
 *
 * Whole units only, and never a precise duration. The queue's lead scan column
 * answers "what has waited longest", which a reader resolves by comparing rows —
 * "3 days" against "2 hours" is the comparison, and "3d 4h 12m" makes it slower
 * rather than more useful.
 *
 * Rounds **down**, deliberately: a case that has waited 59 minutes reads as
 * "under an hour", not as "1 hour". Overstating a wait on a clinical work list
 * would be the wrong direction to err in.
 */
export function formatWaitTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown"

  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`

  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day" : `${days} days`
}
