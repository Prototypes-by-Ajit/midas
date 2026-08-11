import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getAnalysisHistory, toReportRow } from "@/services/analysis.server"
import { getReportsForUser } from "@/services/reports.server"

const ReportsConsole = nextDynamic(() => import("@/comps/dashboard/reports/reports-console"))

export const metadata: Metadata = {
  title: "Reports",
  description: "Generate, preview and download clinical reports.",
}

/**
 * Personalized clinical data — must never be served from a shared cache.
 * `auth()` already forces dynamic rendering; this states the requirement so a
 * later `revalidate` cannot quietly make one user's records cacheable.
 */
export const dynamic = "force-dynamic"

/**
 * Server Component.
 *
 * Reports come from `generated_reports`, not from the analysis list. Deriving a
 * report row from an analysis was the refresh-loss defect: the row existed only
 * as long as the browser tab that generated it, so a reload showed *Generate
 * Report* again for a document that was already stored (D4, FR-035).
 *
 * Both reads are owner-scoped and run in parallel — they share nothing, and
 * sequencing them would add a round trip to every page load.
 *
 * `serverNow` is stamped here so the first client render agrees with the HTML on
 * what time it is. The console decides staleness and elapsed time from a clock;
 * reading that clock during hydration instead would make the two renders disagree
 * by however long the response took.
 */
export default async function ReportsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const [analysisResult, reportResult] = await Promise.all([
    getAnalysisHistory(session.userId),
    getReportsForUser(session.userId),
  ])

  const analyses = analysisResult.ok ? analysisResult.data : []

  return (
    <ReportsConsole
      reports={reportResult.ok ? reportResult.data : []}
      analyses={analyses.map(toReportRow)}
      analysisHistory={analyses}
      loadFailed={!analysisResult.ok || !reportResult.ok}
      serverNow={Date.now()}
    />
  )
}
