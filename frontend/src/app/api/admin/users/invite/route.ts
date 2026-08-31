import { NextResponse } from "next/server"

import { getSessionUser } from "@/services/auth.server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { inviteUser, writeRoleDenialAuditRow } from "@/services/admin.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// T038 -- FR-USR-3: invite a user, governed (spec.md's Governed Action
// pattern). Admin-only (contract.md §2). Every check here re-runs
// server-side, independent of the client -- the disabled submit button on
// the invite dialog is a convenience, never the actual enforcement
// (spec.md's own words for this exact pattern).
export async function POST(req: Request) {
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
    await writeRoleDenialAuditRow(supabase, { id: sessionUser.userId, role: sessionUser.role }, "user.invite", "user.invite")
    return NextResponse.json({ error_code: "FORBIDDEN", corr_id: "", retryable: false }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>)
  const email = String(body.email ?? "").trim()
  const role = String(body.role ?? "").trim()
  const site = body.site ? String(body.site) : null
  const reason = String(body.reason ?? "").trim()

  if (!email || !role) {
    return NextResponse.json({ error_code: "BAD_REQUEST", corr_id: "", retryable: false }, { status: 400 })
  }

  const result = await inviteUser(
    supabase,
    { id: sessionUser.userId, role: sessionUser.role },
    { email, role, site, reason },
  )

  if (result.outcome === "refused") {
    return NextResponse.json(
      { error_code: result.errorCode ?? "REFUSED", corr_id: result.evtId ?? "", retryable: result.errorCode === "DOMAIN_CALL_FAILED" },
      { status: result.errorCode === "EMPTY_REASON" ? 400 : 502 },
    )
  }

  // "duplicate" renders the identical success state as a first-time "allowed"
  // (spec.md design review Pass 2 finding) -- the caller cannot reliably tell
  // a genuine retry apart from a first attempt, so this response body is
  // deliberately the same shape either way.
  return NextResponse.json({ outcome: result.outcome, evt_id: result.evtId })
}
