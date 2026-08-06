import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getAnalysisHistory, toReportRow } from "@/services/analysis.server"

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

/** Server Component. Reports are derived here from the same analysis records the history page reads. */
export default async function ReportsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getAnalysisHistory(session.userId)
  const analyses = result.ok ? result.data : []

  return (
    <ReportsConsole
      reports={analyses.map(toReportRow)}
      analysisHistory={analyses}
      loadFailed={!result.ok}
    />
  )
}
