import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  IconArrowRight,
  IconClipboardList,
  IconClockPause,
  IconScanEye,
  IconTargetArrow,
} from "@tabler/icons-react"

import { MetricTile } from "@/components/clinical/metric-tile"
import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { ErrorState } from "@/components/clinical/states"
import { Button } from "@/components/ui/button"
import {
  ADMIN_SHORTCUT,
  CLINICIAN_SHORTCUT,
  OVERVIEW_SHORTCUTS,
} from "@/data/dashboard/overview"
import {
  RecentActivity,
} from "@/comps/dashboard/overview/recent-activity"
import {
  ServiceStatusPanel,
  ServiceStatusSkeleton,
} from "@/comps/dashboard/overview/service-status-panel"
import { getDashboardOverview } from "@/services/dashboard.server"
import { getSessionUser } from "@/services/auth.server"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your analyses, reports and pending work.",
}

/**
 * Personalized clinical data — must never be served from a shared cache.
 * `auth()` already forces dynamic rendering; this states the requirement so a
 * later `revalidate` cannot quietly make one user's records cacheable.
 */
export const dynamic = "force-dynamic"

/** Server Component. No interactive state on this page, so it ships no JS of its own. */
export default async function DashboardPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const { userId, firstName, role } = session
  const result = await getDashboardOverview(userId)

  // Admin/clinician destinations are appended server-side, so a patient's HTML
  // never contains them at all.
  const shortcuts = [
    ...OVERVIEW_SHORTCUTS,
    ...(role === "clinician" ? [CLINICIAN_SHORTCUT] : []),
    ...(role === "admin" ? [ADMIN_SHORTCUT] : []),
  ]

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Review recent work, or begin a new dermoscopic image analysis."
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/dashboard/analysis">
              <IconScanEye aria-hidden />
              Start new analysis
            </Link>
          </Button>
        }
      />

      {!result.ok ? (
        <ErrorState
          title="Could not load your dashboard data"
          body="Your analyses and reports could not be read just now. Navigation still works, and nothing has been lost — reload to try again."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Reload</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Total analyses"
              value={result.data.totalAnalyses}
              icon={IconScanEye}
              note={
                result.data.recentAnalyses > 0
                  ? `${result.data.recentAnalyses} in the last 7 days`
                  : "None in the last 7 days"
              }
            />
            <MetricTile
              label="Reports"
              value={result.data.totalReports}
              icon={IconClipboardList}
              note="Generated for your account"
            />
            <MetricTile
              label="Pending work"
              value={result.data.pendingWork}
              icon={IconClockPause}
              note={
                result.data.pendingWork > 0
                  ? "Queued or still processing"
                  : "Nothing waiting"
              }
            />
            <MetricTile
              label="Mean confidence"
              value={
                result.data.avgConfidence == null
                  ? "—"
                  : `${(result.data.avgConfidence * 100).toFixed(1)}%`
              }
              icon={IconTargetArrow}
              note={
                result.data.avgConfidence == null
                  ? "No completed analyses yet"
                  : "Across completed analyses"
              }
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section aria-labelledby="activity-heading" className="lg:col-span-2">
              <SectionHeading
                id="activity-heading"
                title="Recent activity"
                action={
                  <Link
                    href="/dashboard/history"
                    className="rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    View all
                  </Link>
                }
              />
              <RecentActivity items={result.data.activity} />
            </section>

            <div className="flex flex-col gap-6">
              {/* Probes a live dependency — streamed so it never delays the page. */}
              <Suspense fallback={<ServiceStatusSkeleton />}>
                <ServiceStatusPanel userId={userId} />
              </Suspense>

              <section aria-labelledby="shortcuts-heading">
                <SectionHeading
                  id="shortcuts-heading"
                  title="Elsewhere in MIDAS"
                />
                <ul className="divide-y rounded-xl border bg-card">
                  {shortcuts.map(({ title, url, icon: Icon, description }) => (
                    <li key={url}>
                      <Link
                        href={url}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {description}
                          </span>
                        </span>
                        <IconArrowRight
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
