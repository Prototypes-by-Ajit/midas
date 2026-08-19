import { NextResponse } from "next/server"

import { failureCode, forbidden, unauthenticated, failureResponse } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import { getReviewQueue } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * The clinician work list: unclaimed cases plus this clinician's own claimed
 * cases, oldest waiting first (contract §2).
 *
 * THE ROLE CHECK PRECEDES THE QUERY, and that ordering is the requirement rather
 * than a style preference. A handler that queries first and refuses afterwards
 * has already read every unclaimed case in the system before returning its 403 —
 * the status would be right and the access would have happened anyway. Contract
 * §4 row 7 says "before any query" for exactly this reason, and T019 asserts it.
 *
 * Role comes from `getSessionUser()` and from nowhere else (FR-032).
 */
export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "queue.read", null, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "queue.read", null, "FORBIDDEN")
      return forbidden("The review queue is for clinicians.")
    }

    const queue = await getReviewQueue(session.userId)
    if (!queue.ok) {
      logRefusal(session.userId, session.role, "queue.read", null, failureCode(queue.reason, "case"))
      return failureResponse(queue.reason, "case")
    }

    logAllowed(session.userId, session.role, "queue.read", null)

    return NextResponse.json(
      {
        cases: queue.data.map((row) => ({
          id: row.id,
          review_state: row.review_state,
          created_at: row.created_at,
          claimed_by: row.claimed_by ?? null,
          claimed_at: row.claimed_at ?? null,
          waited_ms: row.waited_ms,
          // The inference outcome, so the list can show which cases produced no
          // usable result without a second round trip per row. Labelled by the
          // presentation layer as a model output, never as a finding (FR-050).
          status: row.status ?? null,
          diagnosis: row.diagnosis ?? null,
          confidence: row.confidence ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical queue route error:", error)
    return failureResponse("unavailable", "case")
  }
}
