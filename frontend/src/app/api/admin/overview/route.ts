import { NextResponse } from "next/server"

import { getSessionUser } from "@/services/auth.server"
import { getOverview } from "@/services/admin.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// T043 -- FR-OV-1's 30-second poll. The initial render of
// /dashboard/admin/overview fetches the same data server-side, directly
// (no self-referencing hop); this route exists only so the client-side poll
// island (`OverviewPoll`, "use client") has something same-origin to call on
// each tick. Forwards every signed-in request regardless of role -- it does
// NOT refuse on role itself. FastAPI's own require_role() is the sole
// authority and the sole place a `refused` audit row gets written; a BFF
// short-circuit here would let a role-mismatched poll tick reach a dead end
// that never gets logged (spec.md's Access Denial Logging pattern, F5).
export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error_code: "UNAUTHENTICATED", corr_id: "", retryable: false }, { status: 401 })
  }

  const result = await getOverview({ id: session.userId, role: session.role })
  if (!result.ok) {
    return NextResponse.json(
      { error_code: result.status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE", corr_id: "", retryable: result.status !== 403 },
      { status: result.status },
    )
  }

  return NextResponse.json(result.data)
}
