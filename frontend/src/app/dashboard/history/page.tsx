import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getAnalysisHistory, toHistoryEntry } from "@/services/analysis.server"
import { getLatestReportsByAnalysis } from "@/services/reports.server"

const HistoryConsole = nextDynamic(() => import("@/comps/dashboard/history/history-console"))

export const metadata: Metadata = {
  title: "History",
  description: "Every analysis you have run, with filters and PDF export.",
}

/**
 * Personalized clinical data — must never be served from a shared cache.
 * `auth()` already forces dynamic rendering; this states the requirement so a
 * later `revalidate` cannot quietly make one user's records cacheable.
 */
export const dynamic = "force-dynamic"

/** Server Component. Rows are read here, so the list is populated in the first HTML. */
export default async function HistoryPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  // The console can no longer look reports up itself — it used to query
  // `generated_reports` from the browser with no owner predicate. The lookup is
  // owner-scoped and happens here, so the console reuses an existing report
  // instead of generating a duplicate on every click.
  const [result, reports] = await Promise.all([
    getAnalysisHistory(session.userId),
    getLatestReportsByAnalysis(session.userId, "patient_report"),
  ])

  const reportIdByAnalysis = reports.ok
    ? Object.fromEntries(
        Object.entries(reports.data).map(([analysisId, report]) => [analysisId, report.id])
      )
    : {}

  return (
    <HistoryConsole
      entries={result.ok ? result.data.map(toHistoryEntry) : []}
      loadFailed={!result.ok}
      reportIdByAnalysis={reportIdByAnalysis}
    />
  )
}
