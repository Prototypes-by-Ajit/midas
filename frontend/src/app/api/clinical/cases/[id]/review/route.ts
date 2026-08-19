import { NextResponse } from "next/server"
import { z } from "zod"

import { REVIEW_OUTCOMES } from "@/lib/clinical/contract"
import { errorBody } from "@/lib/reports/contract"
import { failureCode, failureResponse, forbidden, unauthenticated } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import { recordReview, resumeReview } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * Record a decision, or ask the patient for more data.
 *
 * The role check comes first and refuses before anything is read or written. Both
 * T019 and T020 post a body carrying plausible clinical intent — a patient asking
 * for sign-off, an admin "signing off on behalf of the clinician" — so the
 * refusal cannot be incidental to a malformed request. Neither identity is a
 * clinician, and there is no privileged path for either (contract §4 rows 2, 10).
 *
 * D2: recording a decision also creates `report_versions` v1 in `draft`, inside
 * the same transaction as the `case_reviews` row. `recordReview` calls the D3
 * `plpgsql` function to get that, because two client round trips can leave a
 * decision with no report — a clinician told their decision was recorded, with
 * nothing to sign — and no application-side retry repairs it.
 */

/**
 * E5: `note` is clinician-authored free text that reaches a patient, so it is
 * bounded here and stored as text.
 *
 * The ceiling is generous because the note IS the clinical content — Constitution
 * II keeps this feature out of the business of inventing labels, which leaves
 * prose as the only place a finding can live. `outcome` is validated against the
 * contract's closed set, not a free string: membership is closed, and a value
 * outside the set is an error rather than a substitution.
 */
const MAX_NOTE_LENGTH = 4000

const reviewSchema = z.object({
  outcome: z.enum(REVIEW_OUTCOMES),
  note: z.string().trim().min(1, "A note is required.").max(MAX_NOTE_LENGTH),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "case.review", id, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "case.review", id, "FORBIDDEN")
      return forbidden("Only a clinician can record a decision on a case.")
    }

    // Parsed after the role check, so a refusal never depends on the body being
    // well-formed — and `role` or `clinician_id` in the body reaches nothing
    // regardless, because the schema does not name them (FR-032).
    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = null
    }

    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      // The code, never the note. A refusal log that quotes what was refused has
      // handed the clinician's free text to whoever reads logs.
      logRefusal(session.userId, session.role, "case.review", id, "INVALID_REQUEST")
      return NextResponse.json(
        errorBody(
          "INVALID_REQUEST",
          "That decision could not be recorded as written.",
          parsed.error.issues[0]?.message,
        ),
        { status: 422 },
      )
    }

    const recorded = await recordReview(id, session.userId, parsed.data)
    if (!recorded.ok) {
      logRefusal(session.userId, session.role, "case.review", id, failureCode(recorded.reason, "case"))
      return failureResponse(recorded.reason, "case")
    }

    logAllowed(session.userId, session.role, "case.review", id)

    return NextResponse.json(
      {
        case_id: id,
        review_id: recorded.data.review_id,
        outcome: parsed.data.outcome,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical review route error:", error)
    return failureResponse("unavailable", "case")
  }
}

/**
 * FR-007 — the return loop. Send a case that was waiting on the patient back
 * into review.
 *
 * `PATCH` rather than a third `outcome` on the POST above. `REVIEW_OUTCOMES` is
 * a closed set mirrored in `backend/app/contracts/clinical_contract.py` and in
 * migration `015`'s CHECK constraint, and resuming a case is not a review
 * outcome — no `case_reviews` row describes it, because nothing clinical was
 * decided. Adding a member would have meant a three-file contract change and a
 * migration to express a state transition that already exists in
 * `ALLOWED_CASE_TRANSITIONS`.
 *
 * No body. The transition takes no arguments: which case is in the path, who is
 * acting is in the session, and the only legal source state is checked twice —
 * once on the scoped read and once in the write predicate.
 *
 * The claim survives (D5), which is the entire named assertion. `resumeReview`
 * does not touch `claimed_by`, so `getReviewQueue` returns the case to the
 * clinician who holds it and to nobody else.
 */
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "case.resume", id, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "case.resume", id, "FORBIDDEN")
      return forbidden("Only a clinician can return a case to the review queue.")
    }

    const resumed = await resumeReview(id, session.userId)
    if (!resumed.ok) {
      logRefusal(session.userId, session.role, "case.resume", id, failureCode(resumed.reason, "case"))
      return failureResponse(resumed.reason, "case")
    }

    logAllowed(session.userId, session.role, "case.resume", id)

    return NextResponse.json(
      { case_id: id, review_state: "awaiting_review" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical resume route error:", error)
    return failureResponse("unavailable", "case")
  }
}
