import { SectionHeading } from "@/components/clinical/page-header"
import { StatusBadge, processTone } from "@/components/clinical/status-badge"
import { getServiceStatus } from "@/services/dashboard.server"

/**
 * Quiet, real service status. Async Server Component — render it inside a
 * `<Suspense>` so a hanging dependency delays only this panel.
 *
 * Every row is an actual probe result. Dependencies we cannot determine report
 * "unknown"; nothing here is hardcoded to look healthy.
 */
export async function ServiceStatusPanel({ userId }: { userId: string }) {
  const services = await getServiceStatus(userId)

  return (
    <section aria-labelledby="service-status-heading">
      <SectionHeading id="service-status-heading" title="Service status" />
      <ul className="divide-y rounded-xl border bg-card">
        {services.map((s) => (
          <li
            key={s.service}
            className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{s.service}</p>
              <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
            </div>
            <StatusBadge tone={processTone(s.status)} dot className="shrink-0">
              {s.status}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Matches the panel's real dimensions: heading + two 52px rows. */
export function ServiceStatusSkeleton() {
  return (
    <section>
      <SectionHeading title="Service status" />
      <ul className="divide-y rounded-xl border bg-card">
        {Array.from({ length: 2 }).map((_, i) => (
          <li
            key={i}
            className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="space-y-1">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
          </li>
        ))}
      </ul>
    </section>
  )
}
