import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied } from "@/components/clinical/states"
import { HealthPoll } from "@/components/admin/health-poll"
import { getSessionUser } from "@/services/auth.server"
import { getHealthServices } from "@/services/admin.server"
import { emitAdminEvent } from "@/lib/admin/analytics"

export const metadata: Metadata = {
  title: "System health",
  description: "Service status, latency, and error rate.",
}

export const dynamic = "force-dynamic"

/**
 * FR-HLT-1/FR-HLT-5 (T052). Same shape as the Overview page: no local role
 * gate before the fetch, `getHealthServices()` always calls FastAPI with the
 * caller's real role so a denial is always logged (F5).
 */
export default async function AdminHealthPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getHealthServices({ id: session.userId, role: session.role })

  // T061 -- PRD §17.
  const degradedSourcesCount = result.ok
    ? result.data.services.filter((s) => s.status !== "operational").length
    : null
  emitAdminEvent("admin_view_opened", { role: session.role, view: "health", degraded_sources_count: degradedSourcesCount })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="System health"
        description="Refreshed every 15 seconds. Select a service for its 24-hour trend."
      />

      {!result.ok ? (
        result.status === 403 ? (
          <PermissionDenied requiredRole="Admin, ML Engineer, or SRE" />
        ) : (
          <ErrorState />
        )
      ) : (
        <HealthPoll initial={result.data} />
      )}
    </div>
  )
}
