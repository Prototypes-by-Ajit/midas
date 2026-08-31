import { NextResponse } from "next/server"

import { getSessionUser } from "@/services/auth.server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { offboardUser, writeRoleDenialAuditRow } from "@/services/admin.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = { id: string }

// T040 -- FR-USR-5 (offboard half): governed. Admin-only. Session/token
// revocation happens before the audit row is ever finalized to `allowed`
// (eng review Tension 3) -- access is cut the moment revocation succeeds,
// never claimed by the audit trail ahead of it actually happening.
export async function POST(req: Request, { params }: { params: Promise<RouteParams> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error_code: "UNAUTHENTICATED", corr_id: "", retryable: false }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error_code: "SERVICE_UNAVAILABLE", corr_id: "", retryable: true },
      { status: 500 },
    )
  }

  if (sessionUser.role !== "admin") {
    await writeRoleDenialAuditRow(supabase, { id: sessionUser.userId, role: sessionUser.role }, "user.offboard", "user.offboard")
    return NextResponse.json({ error_code: "FORBIDDEN", corr_id: "", retryable: false }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}) as Record<string, unknown>)
  const reason = String(body.reason ?? "").trim()

  const result = await offboardUser(supabase, { id: sessionUser.userId, role: sessionUser.role }, id, reason)

  if (result.outcome === "refused") {
    return NextResponse.json(
      { error_code: result.errorCode ?? "REFUSED", corr_id: result.evtId ?? "", retryable: result.errorCode === "DOMAIN_CALL_FAILED" },
      { status: result.errorCode === "EMPTY_REASON" ? 400 : result.errorCode === "LAST_ADMIN_GUARD" ? 409 : 502 },
    )
  }

  return NextResponse.json({ outcome: result.outcome, evt_id: result.evtId })
}
