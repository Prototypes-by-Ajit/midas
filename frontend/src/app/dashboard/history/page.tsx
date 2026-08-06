import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getAnalysisHistory, toHistoryEntry } from "@/services/analysis.server"

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

  const result = await getAnalysisHistory(session.userId)

  return (
    <HistoryConsole
      entries={result.ok ? result.data.map(toHistoryEntry) : []}
      loadFailed={!result.ok}
    />
  )
}
