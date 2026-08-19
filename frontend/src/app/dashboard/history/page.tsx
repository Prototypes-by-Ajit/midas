import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getAnalysisHistory, toHistoryEntry } from "@/services/analysis.server"
import { getLatestReportsByAnalysis } from "@/services/reports.server"
import {
  describeVersionDocument,
  getReleasedVersionsByAnalysis,
} from "@/services/clinical.server"
import type { VersionPanelProps } from "@/components/clinical/version-panel"

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
  //
  // Deliberately not filtered by type: the console now offers all four, and a
  // lookup pinned to one of them would fail to find the other three and mint a
  // duplicate on the next click.
  const [result, reports, released] = await Promise.all([
    getAnalysisHistory(session.userId),
    getLatestReportsByAnalysis(session.userId),
    getReleasedVersionsByAnalysis(session.userId),
  ])

  const entries = result.ok ? result.data.map(toHistoryEntry) : []
  const releasedRows = released.ok ? released.data : {}

  /**
   * T042/T050/T052. One probe per released version — bounded by how many of this
   * patient's cases actually reached release, which is far fewer than the rows
   * on the page, and zero for a patient who has never been through review.
   */
  const releasedVersions: Record<string, VersionPanelProps> = Object.fromEntries(
    await Promise.all(
      Object.entries(releasedRows).map(async ([analysisId, version]) => [
        analysisId,
        {
          versionNumber: version.version_number,
          documentState: await describeVersionDocument(version),
          signedBy: version.signed_by,
          signedAt: version.signed_at,
          releasedAt: version.released_at,
          correctionStartedAt: version.correction_started_at,
        } satisfies VersionPanelProps,
      ])
    )
  )

  /**
   * FR-026, and the gap this feature would otherwise leave open on the one path
   * that does not go through the tested API.
   *
   * `getLatestReportsByAnalysis` scopes by `user_id` and nothing else, so it
   * happily returns the `generated_reports` row that `record_case_decision`
   * creates the moment a clinician records a decision — before signature, before
   * release. T018 refuses exactly that at the API layer; this console reached
   * around it. Release is the patient-visibility gate, not signature.
   *
   * The predicate is "in review AND not released", not "not released": an
   * analysis with a NULL `review_state` never entered this pipeline, and a report
   * the patient generated themselves must keep working exactly as it did (G3).
   */
  const inReviewWithoutRelease = new Set(
    entries
      .filter((entry) => entry.review_state !== null && !releasedVersions[entry.id])
      .map((entry) => entry.id)
  )

  const reportIdByAnalysis = reports.ok
    ? Object.fromEntries(
        Object.entries(reports.data)
          .filter(([analysisId]) => !inReviewWithoutRelease.has(analysisId))
          .map(([analysisId, report]) => [analysisId, report.id])
      )
    : {}

  return (
    <HistoryConsole
      entries={entries}
      loadFailed={!result.ok}
      reportIdByAnalysis={reportIdByAnalysis}
      releasedVersions={releasedVersions}
    />
  )
}
