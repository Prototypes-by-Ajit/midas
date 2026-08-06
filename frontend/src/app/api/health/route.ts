import { NextResponse } from "next/server"

/**
 * Liveness only: "this Next.js process is running and serving".
 *
 * Deliberately does NOT probe Supabase or the Python backend, and deliberately
 * never returns 503. `k8s/base/frontend.yaml` points BOTH `livenessProbe` and
 * `readinessProbe` at this path, so failing it on a dependency hiccup would
 * restart the frontend pods — turning a degraded read into an outage.
 *
 * The old payload was just `{ status: "ok" }`, which reads as "everything is
 * healthy" while measuring nothing. `scope` and the empty `checks` array say
 * what was actually verified. For dependency-aware readiness, add a separate
 * route and repoint only the readinessProbe at it — the backend already splits
 * these properly (`/healthz` vs `/readyz` in backend/app/main_agent.py).
 *
 * Dashboard service status does not use this endpoint; it runs real probes in
 * `src/services/dashboard.server.ts`.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    scope: "liveness",
    checks: [],
  })
}
