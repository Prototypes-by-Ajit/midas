"use client"



import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricTile } from "@/components/clinical/metric-tile"
import { PageHeader } from "@/components/clinical/page-header"
import { CaseReviewNotice } from "@/components/clinical/case-review-notice"
import { VersionPanel, type VersionPanelProps } from "@/components/clinical/version-panel"
import { hasNoUsableResult } from "@/data/clinical/case-presentation"
import { StatusBadge, riskTone } from "@/components/clinical/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  IconHistory,
  IconEye,
  IconSearch,
  IconCalendar,
  IconScanEye,
  IconClock,
  IconDownload,
  IconRefresh,
  IconTrash,
  IconX,
  IconFileTypePdf,
  IconLoader2
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { GenerateReportDialog, type ReportConfig } from "@/components/generate-report-dialog"
import type { HistoryEntry } from "@/types/dashboard"

/**
 * Analysis history. Rows arrive already shaped from the server page — the old
 * `AnalyticsContext` fetched them in the browser, so this list rendered empty
 * until that request resolved.
 *
 * Mutations still go through the existing route handlers, then `router.refresh()`
 * re-runs the server page rather than mutating a client cache.
 *
 * Reports are reached only through server routes. This component used to query
 * the reports table directly and mint storage signing links from a browser
 * anon-key client, with no user predicate on either query — it filtered on
 * `analysis_id` and `report_type` alone. Those reads failed closed only because
 * the table's RLS compared a Supabase Auth UUID with a Clerk id and could never
 * match; that is accidental safety, not enforcement. `reportIdByAnalysis` now
 * arrives from the server page, already owner-scoped. Nothing in `comps/` may
 * name that table or sign a storage URL again — a grep for either is the guard.
 */
export default function HistoryConsole({
  entries,
  loadFailed,
  reportIdByAnalysis = {},
  releasedVersions = {},
}: {
  entries: HistoryEntry[]
  loadFailed: boolean
  /**
   * analysis id → newest report id of any type owned by this user.
   *
   * The server page now withholds this for a case that is in review and has no
   * released version (FR-026) — release is the patient-visibility gate, and a
   * `generated_reports` row exists from the moment a decision is recorded.
   */
  reportIdByAnalysis?: Record<string, string>
  /**
   * analysis id → the released version, already resolved against storage.
   *
   * Absent for every case that has not reached release, which includes every
   * analysis that never entered review at all.
   */
  releasedVersions?: Record<string, VersionPanelProps>
}) {
  const router = useRouter()

  const history = entries

  const requestDelete = async (id: string) => {
    const response = await fetch(`/api/analysis/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to delete" }))
      throw new Error(errorData.error || "Failed to delete analysis")
    }
  }

  const deleteAnalysis = async (id: string) => {
    try {
      await requestDelete(id)
    } catch (error) {
      console.error("Error deleting analysis:", error)
      alert("Failed to delete analysis. Please try again.")
    } finally {
      router.refresh()
    }
  }

  /** One refresh for the whole batch, not one per row. */
  const deleteAll = async () => {
    const results = await Promise.allSettled(history.map((entry) => requestDelete(entry.id)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0) {
      console.error(`Failed to delete ${failed} of ${history.length} analyses`)
      alert(`Failed to delete ${failed} of ${history.length} records. Please try again.`)
    }
    router.refresh()
  }

  const refreshData = () => router.refresh()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterRisk, setFilterRisk] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  // The open report: its signed preview URL for the viewer, and its id so the
  // Download button can go through our own route rather than the storage link.
  const [openReport, setOpenReport] = useState<{ id: string; previewUrl: string } | null>(null)
  // The analysis awaiting a report-type choice, or null when the picker is shut.
  const [pickerAnalysisId, setPickerAnalysisId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  /**
   * Generate a report of the type the person actually chose.
   *
   * This hard-coded the type. With four types offered elsewhere in the product,
   * a fixed choice here meant the history page silently produced one kind of
   * document while the picker implied a choice existed — the same substitution
   * this feature exists to remove, one level up. The type now comes from the
   * shared picker.
   */
  const generateReport = async (analysisId: string, config: ReportConfig) => {
    const response = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_id: analysisId, config }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Failed to generate report')
    }

    return result
  }

  /**
   * A preview link for an existing report, or null if there is nothing stored.
   *
   * The route re-signs on every call, so a report generated hours ago is still
   * reachable — the old client-side link expired after an hour and left the
   * document stored but unopenable.
   */
  const fetchPreviewUrl = async (reportId: string): Promise<string | null> => {
    const response = await fetch(`/api/reports/${reportId}/preview`)
    if (!response.ok) return null
    const result = await response.json().catch(() => ({}))
    return result.preview_url ?? null
  }

  /**
   * Open the stored report for this analysis, or report that there isn't one.
   *
   * Generation is not idempotent — each POST creates a new immutable report — so
   * nothing is generated here. When there is nothing stored the caller asks which
   * type to produce instead of choosing on the person's behalf.
   */
  const openStoredReport = async (analysisId: string): Promise<boolean> => {
    const existingId = reportIdByAnalysis[analysisId]
    if (!existingId) return false

    const previewUrl = await fetchPreviewUrl(existingId)
    if (!previewUrl) return false

    setOpenReport({ id: existingId, previewUrl })
    return true
  }

  /** Send the browser to our own download route; the server names the file. */
  const downloadReport = (reportId: string) => {
    const link = document.createElement('a')
    link.href = `/api/reports/${reportId}/download`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleViewDetails = async (analysisId: string) => {
    try {
      setIsGeneratingReport(true)
      setSelectedEntry(analysisId)

      if (!(await openStoredReport(analysisId))) setPickerAnalysisId(analysisId)
    } catch (error) {
      console.error('Error viewing details:', error)
      alert('Failed to load report. Please try again.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleExportPDF = async (analysisId: string) => {
    const existingId = reportIdByAnalysis[analysisId]
    if (!existingId) {
      // Nothing to export yet. Ask which type to produce rather than picking one.
      setSelectedEntry(analysisId)
      setPickerAnalysisId(analysisId)
      return
    }

    try {
      setExportingId(analysisId)
      downloadReport(existingId)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExportingId(null)
    }
  }

  const handleGenerateChosenReport = async (config: ReportConfig) => {
    if (!pickerAnalysisId) return

    try {
      setIsGeneratingReport(true)
      const result = await generateReport(pickerAnalysisId, config)
      if (!result.report_id || !result.preview_url) {
        throw new Error('Report generation failed')
      }

      setOpenReport({ id: result.report_id, previewUrl: result.preview_url })
      setPickerAnalysisId(null)
      // The stored report is new; the server page owns the id→report map.
      router.refresh()
    } catch (error) {
      console.error('Error generating report:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate report.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Close modal
  const closeModal = () => {
    setSelectedEntry(null)
    setOpenReport(null)
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }


  const filteredHistory = history
    .filter(entry => {
      const diagnosis = entry.diagnosis || "Unknown"
      const imageName = entry.imageName || "Unknown"
      const matchesSearch = 
        diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        imageName.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRisk = filterRisk === "all" || entry.risk_level === filterRisk

      return matchesSearch && matchesRisk
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        case "oldest":
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        case "confidence":
          return b.confidence - a.confidence
        case "diagnosis":
          return (a.diagnosis || "Unknown").localeCompare(b.diagnosis || "Unknown")
        default:
          return 0
      }
    })

  const thisWeekCount = history.filter(entry => {
    const entryDate = new Date(entry.timestamp)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return entryDate >= weekAgo
  }).length
  const avgAnalysisTime = history.length > 0 ? history.reduce((sum, entry) => sum + entry.analysisTime, 0) / history.length : 0
  const avgConfidence = history.length > 0 ? history.reduce((sum, entry) => sum + entry.confidence, 0) / history.length : 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-background">
      <PageHeader
        title="Analysis History"
        description="View your complete analysis history and track your usage patterns"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "History" }]}
        action={
          history.length > 0 ? (
            <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ALL ${history.length} analysis records?\n\nThis action cannot be undone.`)) {
                deleteAll()
              }
            }}
            className="border-critical/25 text-critical hover:bg-critical hover:text-white dark:border-critical/25 dark:text-critical dark:hover:bg-critical"
          >
            <IconTrash className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
          ) : undefined
        }
      />

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Total analyses"
          value={history.length}
          icon={IconScanEye}
          note="All time"
        />
        <MetricTile
          label="This week"
          value={thisWeekCount}
          icon={IconCalendar}
          note="Analyses performed"
        />
        <MetricTile
          label="Mean analysis time"
          value={history.length > 0 ? `${avgAnalysisTime.toFixed(1)}s` : "—"}
          icon={IconClock}
          note="Processing time"
        />
        <MetricTile
          label="Mean confidence"
          value={history.length > 0 ? `${(avgConfidence * 100).toFixed(1)}%` : "—"}
          icon={IconHistory}
          /* Not accuracy: there is no ground truth at inference time, so
             accuracy cannot be computed from these rows at all. */
          note="Mean confidence, not accuracy"
        />
      </section>

      {/* Filters and Controls */}
      <Card className="bg-background border border-border relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <IconSearch className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by diagnosis, entry ID, or image name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
            </div>
            
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="indeterminate">Indeterminate</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="confidence">By Confidence</option>
              <option value="diagnosis">By Diagnosis</option>
            </select>

            <Button 
              variant="outline"
              onClick={refreshData}
            >
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <div className="space-y-4">
        {filteredHistory.map((entry) => {
          const dateTime = formatDate(entry.timestamp)

          // T043. A valid outcome, not an error: the model produced nothing
          // usable and a person now looks at the case. Everything downstream of
          // this flag suppresses a number or a word that would otherwise be
          // fabricated from an absent result.
          const noResult = hasNoUsableResult({ status: entry.status, diagnosis: entry.diagnosis })

          const releasedVersion = releasedVersions[entry.id]

          // T041/G4. The control is REPLACED, not disabled — a greyed button
          // with a tooltip explaining itself is invisible on a touch screen,
          // which is where most of these are read.
          const awaitingClinicianReport = entry.review_state !== null && !releasedVersion

          return (
            <Card key={entry.id} className="bg-background border border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Timeline Indicator */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center">
                      <IconHistory className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Entry Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        {/*
                          T043. No score, no risk word, no percentage — the risk
                          badge and the diagnosis heading are both suppressed
                          rather than filled with "Unknown", because "UNKNOWN
                          RISK" reads as a risk assessment that came back
                          inconclusive when nothing was ever assessed. Rendered
                          through the normal path, never through `ErrorState`:
                          nothing broke (FR-042).
                        */}
                        {noResult ? (
                          <div className="mb-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              The automated step didn&apos;t produce a result.
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              A clinician is reviewing your case.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              {entry.diagnosis}
                            </h3>
                            <StatusBadge tone={riskTone(entry.risk_level)} dot>
                              {(entry.risk_level || "unknown").toUpperCase()} RISK
                            </StatusBadge>
                          </div>
                        )}
                        {/*
                          T040/G3. Renders `null` when `review_state` is NULL, so
                          an analysis that predates clinical review produces the
                          same tree it produced before this feature existed — no
                          badge, no wrapper, no empty node.
                        */}
                        <CaseReviewNotice
                          role="patient"
                          reviewState={entry.review_state}
                          className="mb-2"
                        />
                        {/*
                          T042/T050/T052. Present only once a version is
                          released, so it is absent for every pre-feature row and
                          the tree above is unchanged for them (G3). A version
                          under correction still appears here — it keeps its
                          `released_at` — which is SC-012: the previously
                          released version stays readable throughout.
                        */}
                        {releasedVersion && (
                          <div className="mb-2">
                            <VersionPanel {...releasedVersion} />
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <IconScanEye className="h-4 w-4" />
                            <span>{entry.imageName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <IconCalendar className="h-4 w-4" />
                            <span>{dateTime.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <IconClock className="h-4 w-4" />
                            <span>{dateTime.time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>Size: {entry.imageSize}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {awaitingClinicianReport ? (
                          <p className="text-sm text-muted-foreground">
                            A clinician is preparing your report. It will appear here when
                            it&apos;s ready.
                          </p>
                        ) : (
                          <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(entry.id)}
                          disabled={isGeneratingReport && selectedEntry === entry.id}
                        >
                          {isGeneratingReport && selectedEntry === entry.id ? (
                            <>
                              <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <IconEye className="h-4 w-4 mr-1" />
                              View Details
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportPDF(entry.id)}
                          disabled={exportingId === entry.id}
                        >
                          {exportingId === entry.id ? (
                            <>
                              <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <IconDownload className="h-4 w-4 mr-1" />
                              Export
                            </>
                          )}
                        </Button>
                          </>
                        )}
                        {/*
                          Delete stays outside the replacement. T041 names the
                          generate control and nothing else, and removing a
                          person's ability to delete their own record is a
                          policy change no artifact asked for.
                        */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete this analysis?\n\nDiagnosis: ${entry.diagnosis}\nDate: ${dateTime.date} ${dateTime.time}`)) {
                              deleteAnalysis(entry.id)
                            }
                          }}
                          className="border-critical/25 text-critical hover:bg-critical hover:text-white dark:border-critical/25 dark:text-critical dark:hover:bg-critical"
                        >
                          <IconTrash className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Confidence Score
                        </h4>
                        <p className="text-lg font-semibold text-foreground">
                          {(entry.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Analysis Time
                        </h4>
                        <p className="text-lg font-semibold text-foreground">
                          {entry.analysisTime}s
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Entry ID
                        </h4>
                        <p className="text-sm font-mono text-foreground">
                          {entry.id}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Status
                        </h4>
                        <Badge variant="outline" className="border-success/25 text-success">
                          COMPLETED
                        </Badge>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="pt-2 border-t border-border">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Clinical Notes
                        </h4>
                        <p className="text-sm text-foreground italic">
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredHistory.length === 0 && (
        <Card className="bg-background border border-border">
          <CardContent className="p-6 sm:p-12 text-center">
            <IconHistory className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {loadFailed
                ? "Could not load your analysis history"
                : history.length === 0
                  ? "No analysis history yet"
                  : "No history found"}
            </h3>
            <p className="text-muted-foreground">
              {loadFailed
                ? "Your records could not be read just now, and nothing has been lost. Reload to try again."
                : history.length === 0
                  ? "Your analysis history will appear here once you start using MIDAS AI"
                  : "No analyses match your current search criteria"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report-type picker — shown only when this analysis has no report yet.
          The type used to be chosen for the person; now they choose it. */}
      {pickerAnalysisId && (
        <GenerateReportDialog
          open
          onClose={() => setPickerAnalysisId(null)}
          onGenerate={handleGenerateChosenReport}
          analysisId={pickerAnalysisId}
          diagnosis={
            history.find((entry) => entry.id === pickerAnalysisId)?.diagnosis ?? "Unknown"
          }
          isGenerating={isGeneratingReport}
        />
      )}

      {/* PDF Viewer Modal */}
      {openReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="relative w-full h-full max-w-7xl max-h-[95vh] m-4">
            {/* Modal Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-background border-b border-border p-4 rounded-t-lg">
              <div className="flex items-center gap-3">
                <IconFileTypePdf className="h-6 w-6 text-critical" />
                <h3 className="text-lg font-semibold text-foreground">
                  Medical Analysis Report
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  // Through our own route, not the storage link. `download` is
                  // ignored on a cross-origin href, so the old `MIDAS_Report.pdf`
                  // never applied anyway — and the server sets the filename from
                  // the report's own number, which is what is printed inside the
                  // document (FR-024).
                  onClick={() => downloadReport(openReport.id)}
                >
                  <IconDownload className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeModal}
                  className="border-critical/25 text-critical hover:bg-critical hover:text-white dark:border-critical/25 dark:text-critical dark:hover:bg-critical"
                >
                  <IconX className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>

            {/* PDF Iframe */}
            <div className="w-full h-full pt-16 pb-4">
              <iframe
                src={openReport.previewUrl}
                className="w-full h-full rounded-b-lg border border-border bg-card"
                title="Medical Analysis Report"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
