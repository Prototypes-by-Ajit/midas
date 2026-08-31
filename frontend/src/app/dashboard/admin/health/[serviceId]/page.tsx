import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied, EmptyState } from "@/components/clinical/states"
import { StatusBadge, processTone } from "@/components/clinical/status-badge"
import { getSessionUser } from "@/services/auth.server"
import { getHealthServiceDetail } from "@/services/admin.server"
import { IconChartLine } from "@tabler/icons-react"

export const metadata: Metadata = {
  title: "Service detail",
  description: "24-hour trend for one service.",
}

export const dynamic = "force-dynamic"

/**
 * FR-HLT-2's drill-down. No poll requirement exists for this view (only the
 * list on the parent page does) -- a plain server-rendered nested route, no
 * client fetch, one lazy step fewer than a modal/client panel would need.
 */
export default async function ServiceHealthDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getHealthServiceDetail({ id: session.userId, role: session.role }, serviceId)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Service detail"
        crumbs={[{ label: "System health", href: "/dashboard/admin/health" }, { label: serviceId }]}
      />

      {!result.ok ? (
        result.status === 403 ? (
          <PermissionDenied requiredRole="Admin, ML Engineer, or SRE" />
        ) : result.status === 404 ? (
          <ErrorState title="Unknown service" body="This service id doesn't match any monitored service." />
        ) : (
          <ErrorState />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StatusBadge tone={processTone(result.data.status)} dot>
              {result.data.status === "operational" ? "Operational" : result.data.status === "degraded" ? "Degraded" : "Unknown"}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">Target {result.data.target_ms} ms (dashed SLO line)</span>
          </div>

          <section aria-labelledby="series-heading">
            <h2 id="series-heading" className="mb-2 text-sm font-medium text-foreground">24-hour p95</h2>
            {result.data.series_24h.length === 0 ? (
              <EmptyState
                icon={IconChartLine}
                title="No history yet"
                body="This release has no persisted metrics history (OQ7) -- once the telemetry stack is deployed, this fills in."
              />
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {result.data.series_24h.map((point) => (
                  <li key={point.t} className="flex justify-between border-b py-1 text-muted-foreground">
                    <span>{new Date(point.t).toLocaleString()}</span>
                    <span className="tabular-nums text-foreground">{point.p95_ms} ms</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="events-heading">
            <h2 id="events-heading" className="mb-2 text-sm font-medium text-foreground">Recent events</h2>
            {result.data.recent_events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incident data model exists in this release.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {result.data.recent_events.map((event) => (
                  <li key={event.id} className="flex justify-between border-b py-1 text-muted-foreground">
                    <span>{event.label}</span>
                    <span>{new Date(event.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
