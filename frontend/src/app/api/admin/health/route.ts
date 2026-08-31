import { NextResponse } from "next/server"

import { getSessionUser } from "@/services/auth.server"
import { getHealthServices } from "@/services/admin.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// T044 -- FR-HLT-1's 15-second poll. Same shape and same reasoning as
// /api/admin/overview/route.ts (T043): forwards every signed-in request
// regardless of role, never refuses locally -- see that file's own comment
// for why. The drill-down (FR-HLT-2) has no poll requirement and is served
// by its own nested Server Component route instead
// (`/dashboard/admin/health/[serviceId]`), not this route.
export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error_code: "UNAUTHENTICATED", corr_id: "", retryable: false }, { status: 401 })
  }

  const result = await getHealthServices({ id: session.userId, role: session.role })
  if (!result.ok) {
    return NextResponse.json(
      { error_code: result.status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE", corr_id: "", retryable: result.status !== 403 },
      { status: result.status },
    )
  }

  return NextResponse.json(result.data)
}
