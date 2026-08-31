import { NextResponse } from "next/server"

import { getSessionUser } from "@/services/auth.server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { changeUserRole, writeRoleDenialAuditRow } from "@/services/admin.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = { id: string }

// T039 -- FR-USR-5 (role-change half): governed. Admin-only. Takes effect
// only at the target's next sign-in (spec.md's own stated, deliberate
// window) -- this route never force-refreshes the target's session.
export async function PATCH(req: Request, { params }: { params: Promise<RouteParams> }) {
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
    await writeRoleDenialAuditRow(supabase, { id: sessionUser.userId, role: sessionUser.role }, "user.role_change", "user.role_change")
    return NextResponse.json({ error_code: "FORBIDDEN", corr_id: "", retryable: false }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}) as Record<string, unknown>)
  const newRole = String(body.role ?? "").trim()
  const reason = String(body.reason ?? "").trim()

  if (!newRole) {
    return NextResponse.json({ error_code: "BAD_REQUEST", corr_id: "", retryable: false }, { status: 400 })
  }

  const result = await changeUserRole(
    supabase,
    { id: sessionUser.userId, role: sessionUser.role },
    id,
    newRole,
    reason,
  )

  if (result.outcome === "refused") {
    return NextResponse.json(
      { error_code: result.errorCode ?? "REFUSED", corr_id: result.evtId ?? "", retryable: result.errorCode === "DOMAIN_CALL_FAILED" },
      { status: result.errorCode === "EMPTY_REASON" ? 400 : result.errorCode === "LAST_ADMIN_GUARD" ? 409 : 502 },
    )
  }

  return NextResponse.json({ outcome: result.outcome, evt_id: result.evtId })
}
