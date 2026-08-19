import { NextResponse } from "next/server"
import { z } from "zod"

import { errorBody } from "@/lib/reports/contract"
import { failureCode, failureResponse, forbidden, unauthenticated } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import { signVersion } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * Attach a clinician's name to a version, permanently.
 *
 * WHO MAY: a clinician, and only the one holding the case. A patient is refused
 * 403 (T015), an admin is refused 403 (T016), and **an admin is not a senior
 * clinician** — there is no privileged path, no override, and no second role that
 * reaches this handler. A clinician holding no claim on the case gets 404, the
 * same answer as a version that does not exist (contract §4 row 8).
 *
 * T023 posts `{"role": "clinician"}` from a patient session and is still refused.
 * Nothing in the body is consulted for authority; `getSessionUser()` reads the
 * role off the Clerk user record, and a caller cannot write to that (FR-032).
 * The only field this route reads from the body is an optional rationale.
 *
 * The compare-and-set on `signed_at IS NULL` makes a second concurrent signature
 * lose rather than overwrite the first — which matters more here than anywhere
 * else in the slice, because `015`'s append-only trigger then freezes `content`,
 * `content_digest`, `storage_path`, `signed_by` and `signed_at` against every
 * later write. The loser is told 409, not silently ignored.
 */

const signSchema = z.object({
  // Optional per spec A5. `role` and `clinician_id` are deliberately unnamed:
  // an unknown key is dropped, so a forged one cannot reach the service.
  rationale: z.string().trim().max(2000).optional(),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "version.sign", id, "UNAUTHENTICATED")
      return unauthenticated()
    }
    if (session.role !== "clinician") {
      logRefusal(session.userId, session.role, "version.sign", id, "FORBIDDEN")
      return forbidden("Only a clinician can sign a report version.")
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = signSchema.safeParse(body ?? {})
    if (!parsed.success) {
      logRefusal(session.userId, session.role, "version.sign", id, "INVALID_REQUEST")
      return NextResponse.json(
        errorBody(
          "INVALID_REQUEST",
          "That signature could not be recorded as written.",
          parsed.error.issues[0]?.message,
        ),
        { status: 422 },
      )
    }

    const signed = await signVersion(id, session.userId, parsed.data.rationale ?? null)
    if (!signed.ok) {
      logRefusal(session.userId, session.role, "version.sign", id, failureCode(signed.reason, "version"))
      return failureResponse(signed.reason, "version")
    }

    logAllowed(session.userId, session.role, "version.sign", id)

    return NextResponse.json(
      {
        id: signed.data.id,
        version_number: signed.data.version_number,
        state: signed.data.state,
        signed_by: signed.data.signed_by,
        signed_at: signed.data.signed_at,
        // Reported so a reader can see whether a document was covered at all.
        // What it proves is narrow and stays narrow: it detects that the stored
        // document drifted from what was signed. It does not prove who changed
        // it, and nothing here may call it cryptographic verification (FR-054).
        content_digest: signed.data.content_digest,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Clinical sign route error:", error)
    return failureResponse("unavailable", "version")
  }
}
