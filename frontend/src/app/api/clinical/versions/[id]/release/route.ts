import { NextResponse } from "next/server"

import { failureCode, failureResponse, forbidden, unauthenticated } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import { releaseVersion } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * Make a signed version visible to the patient.
 *
 * RELEASE IS THE GATE, NOT SIGNATURE (FR-026). A signed version the patient can
 * already read is precisely the failure `released_at` exists to prevent, and it
 * is why T018 asserts a signed-but-unreleased version is absent from the patient
 * projection — an implementation that treats signature as publication passes the
 * unsigned half of that test and fails this one.
 *
 * Refusing an unsigned version is stated here as a 409 so the caller gets a
 * reason, but the guarantee does not rest on this handler: `015` carries
 * `check (released_at is null or signed_at is not null)`, so the row cannot exist
 * regardless of which code path attempts it (FR-028). Application code that
 * agrees with the database is not redundant — it is the difference between a
 * refusal a clinician can read and a constraint violation.
 *
 * E4: the stored object is confirmed present **before** `released_at` is written.
 * Releasing a version whose document is missing tells a patient their report is
 * ready and then shows them nothing. The refusal is recoverable; that is not.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "version.release", id, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "version.release", id, "FORBIDDEN")
      return forbidden("Only a clinician can release a report version.")
    }

    const released = await releaseVersion(id, session.userId)
    if (!released.ok) {
      logRefusal(session.userId, session.role, "version.release", id, failureCode(released.reason, "version"))
      return failureResponse(released.reason, "version")
    }

    logAllowed(session.userId, session.role, "version.release", id)

    return NextResponse.json(
      {
        id: released.data.id,
        version_number: released.data.version_number,
        released_by: released.data.released_by,
        released_at: released.data.released_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical release route error:", error)
    return failureResponse("unavailable", "version")
  }
}
