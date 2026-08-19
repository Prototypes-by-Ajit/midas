import { NextResponse } from "next/server"

import { failureCode, failureResponse, forbidden, unauthenticated } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import { claimCase } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * Take a case off the shared queue.
 *
 * The race is real and it is a database property, not an application one: two
 * clinicians open the queue, both see the same unclaimed case, both press claim.
 * `claimCase` resolves it with a compare-and-set on `claimed_by IS NULL`, so the
 * loser's `UPDATE` matches zero rows rather than overwriting the winner's claim.
 *
 * The loser is told **409, already claimed** — not 404. E2: a compare-and-set
 * returning zero rows cannot by itself distinguish "someone beat you" from "no
 * such case", and answering 404 to a clinician looking at the case in their own
 * queue is a refusal they cannot act on. The existence probe in the service is
 * what separates the two, plus a third answer for a case that exists, is
 * unclaimed, and is not in a state a claim can be taken from.
 *
 * Nothing in the request body is read. The claimant is `getSessionUser()`.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "case.claim", id, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "case.claim", id, "FORBIDDEN")
      return forbidden("Only a clinician can claim a case for review.")
    }

    const claimed = await claimCase(id, session.userId)
    if (!claimed.ok) {
      logRefusal(session.userId, session.role, "case.claim", id, failureCode(claimed.reason, "case"))
      return failureResponse(claimed.reason, "case")
    }

    logAllowed(session.userId, session.role, "case.claim", id)

    return NextResponse.json(
      {
        id: claimed.data.id,
        review_state: claimed.data.review_state,
        claimed_by: claimed.data.claimed_by ?? null,
        claimed_at: claimed.data.claimed_at ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical claim route error:", error)
    return failureResponse("unavailable", "case")
  }
}
