"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/clinical/page-header"
import { StatusBadge, riskTone } from "@/components/clinical/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  IconFileAnalytics,
  IconDownload,
  IconEye,
  IconSearch,
  IconFilter,
  IconCalendar,
  IconChartPie,
  IconChartBar,
  IconTrendingUp,
  IconFilePlus,
  IconRefresh,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { GenerateReportDialog, type ReportConfig } from "@/components/generate-report-dialog"
import { ReportPreviewDialog } from "@/components/report-preview-dialog"
import {
  missingSections,
  presentStatus,
  type StatusPresentation,
} from "@/data/reports/status-presentation"
import type { SectionsGenerated } from "@/lib/reports/contract"
import { hydrateReports, isStale, type ReportRow as DurableReportRow } from "@/lib/reports/orchestration"
import type { AnalysisRecord, ReportRow as AnalysisRow } from "@/types/dashboard"

// recharts is lazy-loaded: it is ~100 kB and none of these render until the
// account actually has analyses. Each fallback reserves the chart's exact height
// so nothing shifts when the chunk arrives.
const chartFallback = (height: number) => {
  const Fallback = () => <div style={{ height }} aria-hidden />
  Fallback.displayName = "ChartFallback"
  return Fallback
}

const RiskDistributionChart = dynamic(
  () => import("@/comps/dashboard/reports/report-charts").then((m) => m.RiskDistributionChart),
  { ssr: false, loading: chartFallback(250) }
)
const ConfidenceChart = dynamic(
  () => import("@/comps/dashboard/reports/report-charts").then((m) => m.ConfidenceChart),
  { ssr: false, loading: chartFallback(250) }
)
const TimelineChart = dynamic(
  () => import("@/comps/dashboard/reports/report-charts").then((m) => m.TimelineChart),
  { ssr: false, loading: chartFallback(250) }
)
const DiagnosisChart = dynamic(
  () => import("@/comps/dashboard/reports/report-charts").then((m) => m.DiagnosisChart),
  { ssr: false, loading: chartFallback(300) }
)

/**
 * A `generated_reports` row as this console reads it.
 *
 * `DurableReportRow` carries the three fields `hydrateReports` and `isStale` need
 * plus an index signature; the rest are named here so the render body reads them
 * as strings rather than `unknown`. They are optional because a pre-014 row does
 * not carry provenance (Assumption 2).
 */
type ConsoleReport = DurableReportRow & {
  report_number?: string | null
  report_type?: string | null
  analysis_id?: string | null
  degraded_reason?: string | null
  sections_generated?: Record<string, boolean> | null
}

/** After this long the waiting copy changes once. Not a timeout — just a longer wait (D15). */
const LONG_WAIT_MS = 120_000

/**
 * The second thing said to someone still waiting.
 *
 * There is no progress signal to report — the report service streams nothing back
 * until it is done — so this is a change of tone, not of information. Inventing a
 * percentage here would be inventing a measurement (D15).
 */
const LONG_WAIT_LINE =
  "Still going. This one is taking longer than most — it will either finish or tell you why."

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function formatReportType(type: string | null | undefined): string {
  if (!type) return "Report"
  return type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

/**
 * Label + colour + icon, every time (D17).
 *
 * The icon is decorative and marked `aria-hidden`; the label is the text content,
 * so it becomes the chip's accessible name without an `aria-label` that could
 * drift from what is on screen.
 */
function StatusChip({ presentation }: { presentation: StatusPresentation }) {
  const Icon = presentation.icon
  const spins = presentation.label === "Generating…"

  return (
    <Badge className={`inline-flex items-center gap-1.5 ${presentation.chipClass}`}>
      <Icon
        className={`h-3.5 w-3.5 ${spins ? "motion-safe:animate-spin" : ""}`}
        aria-hidden="true"
      />
      {presentation.label}
    </Badge>
  )
}

/**
 * Report list and generation.
 *
 * `reports` are durable `generated_reports` rows read on the server. Before this
 * the list was derived from analyses and held in an empty `useState`, so every
 * reload showed *Generate Report* for documents that were already stored.
 * Client state now holds in-flight transitions only.
 */
export default function ReportsConsole({
  reports,
  analyses,
  analysisHistory,
  loadFailed,
  serverNow,
}: {
  reports: ConsoleReport[]
  analyses: AnalysisRow[]
  analysisHistory: AnalysisRecord[]
  loadFailed: boolean
  serverNow: number
}) {
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterRisk, setFilterRisk] = useState<string>("all")

  // In-flight only. A generation that has not returned yet has no server row, so
  // it is keyed by a synthetic id and dropped the moment the server is re-read.
  const [inFlight, setInFlight] = useState<Map<string, DurableReportRow>>(new Map())

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRow | null>(null)

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [preview, setPreview] = useState<{ url: string; title: string; id: string } | null>(null)

  // One completion announcement, set once when a generation settles (D19).
  // Deliberately *not* the elapsed timer: a live region that re-reads every
  // second would talk over everything else on the page and tell the listener
  // nothing they did not already know.
  const [announcement, setAnnouncement] = useState("")

  // Staleness and elapsed time are read from a clock, and a clock read during
  // hydration disagrees with the one the HTML was rendered against. Starting from
  // the server's stamp makes the two renders identical, then the interval takes
  // over. It only runs while something is actually generating.
  const [now, setNow] = useState(serverNow)

  const rows = useMemo(
    () => hydrateReports(reports, inFlight) as ConsoleReport[],
    [reports, inFlight]
  )

  const anyGenerating = rows.some(
    (row) =>
      (row.generation_status === "generating" || row.generation_status === "pending") &&
      !isStale(row, now)
  )

  useEffect(() => {
    if (!anyGenerating) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [anyGenerating])

  const analysisById = useMemo(
    () => new Map(analysisHistory.map((entry) => [entry.id, entry])),
    [analysisHistory]
  )
  const analysisRowById = useMemo(
    () => new Map(analyses.map((row) => [row.id, row])),
    [analyses]
  )

  // An analysis is "without a report" only when no row of any status points at
  // it. A failed or interrupted report still exists, and its own row carries the
  // Generate again action — listing the analysis a second time below would show
  // the same work twice.
  const analysesWithReport = useMemo(
    () => new Set(rows.map((row) => row.analysis_id).filter(Boolean) as string[]),
    [rows]
  )

  /**
   * Everything each report row needs, derived once.
   *
   * The same row is rendered twice — as a table cell at ≥768 px and as a stacked
   * card below it (D18) — and deriving staleness or elapsed time separately in
   * each is how the two renderings start disagreeing about the same report.
   */
  const describeRow = (row: ConsoleReport) => {
    const stale = isStale(row, now)
    const waiting =
      !stale && (row.generation_status === "generating" || row.generation_status === "pending")
    const elapsed = now - Date.parse(row.created_at)

    return {
      row,
      stale,
      waiting,
      elapsed,
      presentation: presentStatus(row.generation_status, { stale }),
      analysisRow: row.analysis_id ? analysisRowById.get(row.analysis_id) : undefined,
      diagnosis: row.analysis_id ? analysisById.get(row.analysis_id)?.diagnosis : undefined,
      readable:
        row.generation_status === "completed" || row.generation_status === "degraded",
      regenerable: stale || row.generation_status === "failed",
      // The stored column is untyped JSON. `missingSections` reads it by the four
      // known keys and treats an absent one as missing, so a partial or
      // hand-edited row degrades to "missing" rather than to a crash.
      gaps:
        row.generation_status === "degraded"
          ? missingSections((row.sections_generated ?? null) as SectionsGenerated | null)
          : "",
      supporting:
        !stale &&
        (row.generation_status === "generating" || row.generation_status === "pending") &&
        now - Date.parse(row.created_at) >= LONG_WAIT_MS
          ? LONG_WAIT_LINE
          : presentStatus(row.generation_status, { stale }).description,
    }
  }

  /**
   * Preview / Download / Generate again for one row.
   *
   * `touch` raises the targets to 44 px for the stacked-card rendering, which is
   * the one people use with a thumb (D18). The desktop table keeps `sm`.
   */
  const RowActions = ({
    view,
    touch = false,
  }: {
    view: ReturnType<typeof describeRow>
    touch?: boolean
  }) => {
    const size = touch ? "min-h-11 px-4" : ""

    return (
      <>
        {view.readable && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreviewReport(view.row)}
              className={size}
            >
              <IconEye className="h-4 w-4 mr-1" aria-hidden="true" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadReport(view.row)}
              className={size}
            >
              <IconDownload className="h-4 w-4 mr-1" aria-hidden="true" />
              Download
            </Button>
          </>
        )}

        {view.regenerable && view.analysisRow && (
          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenGenerateDialog(view.analysisRow!)}
            className={`bg-primary text-primary-foreground hover:bg-primary/90 ${size}`}
          >
            <IconRefresh className="h-4 w-4 mr-1" aria-hidden="true" />
            Generate again
          </Button>
        )}
      </>
    )
  }

  const term = searchTerm.trim().toLowerCase()
  const filtersActive = term.length > 0 || filterRisk !== "all"

  const visibleReports = rows.filter((row) => {
    if (!term) return true
    const analysis = row.analysis_id ? analysisById.get(row.analysis_id) : undefined
    return [row.report_number, row.report_type, analysis?.diagnosis]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const visibleAnalyses = analyses.filter((analysis) => {
    if (analysesWithReport.has(analysis.id)) return false
    if (filterRisk !== "all" && analysis.risk_level !== filterRisk) return false
    if (!term) return true
    return [analysis.diagnosis, analysis.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const handleOpenGenerateDialog = (analysis: AnalysisRow) => {
    setSelectedAnalysis(analysis)
    setGenerateDialogOpen(true)
  }

  const handleGenerateReport = async (config: ReportConfig) => {
    if (!selectedAnalysis) return

    const analysisId = selectedAnalysis.id
    const placeholderId = `pending:${analysisId}:${config.reportType}`

    setInFlight((prev) =>
      new Map(prev).set(placeholderId, {
        id: placeholderId,
        generation_status: "generating",
        created_at: new Date().toISOString(),
        analysis_id: analysisId,
        report_type: config.reportType,
        report_number: null,
      })
    )
    setGenerateDialogOpen(false)

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_id: analysisId, config }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // The route names what went wrong and why; repeating its message beats
        // replacing it with a generic one that sends nobody anywhere.
        throw new Error(data.error || "The report could not be generated.")
      }

      if (data.generation_status === "degraded") {
        toast.warning("Report generated with gaps", {
          description: "Some sections could not be generated. The rest is usable.",
        })
        setAnnouncement(
          "Report generated with some sections missing. It is ready to preview or download."
        )
      } else {
        toast.success("Report ready", { description: "Your report has been generated." })
        setAnnouncement("Report ready to preview or download.")
      }
    } catch (error) {
      console.error("Error generating report:", error)
      toast.error("Generation failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
      setAnnouncement("Report generation failed. Nothing was saved.")
    } finally {
      // The server row is the truth either way — success wrote one, failure wrote
      // a `failed` one. Re-read, then drop the placeholder that stood in for it.
      router.refresh()
      setInFlight((prev) => {
        const next = new Map(prev)
        next.delete(placeholderId)
        return next
      })
    }
  }

  const handlePreviewReport = async (row: ConsoleReport) => {
    try {
      // Signed on every call. A URL minted at generation time expires an hour
      // later, after which the report is stored, intact and unreachable (FR-037).
      const response = await fetch(`/api/reports/${row.id}/preview`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.preview_url) {
        throw new Error(data.error || "This report could not be opened.")
      }

      const analysis = row.analysis_id ? analysisById.get(row.analysis_id) : undefined
      setPreview({
        url: data.preview_url,
        title: `${formatReportType(row.report_type)} — ${analysis?.diagnosis ?? "Analysis"}`,
        id: row.id,
      })
      setPreviewDialogOpen(true)
    } catch (error) {
      console.error("Error previewing report:", error)
      toast.error("Preview unavailable", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }

  const handleDownloadReport = async (row: ConsoleReport) => {
    try {
      const response = await fetch(`/api/reports/${row.id}/download`)

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "This report could not be downloaded.")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      // A blob URL drops the server's Content-Disposition, so the name is set
      // here — from the report's own number, so the saved file matches what is
      // printed inside the document.
      anchor.download = `${row.report_number ?? row.id}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)

      toast.success("Download complete")
    } catch (error) {
      console.error("Error downloading report:", error)
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilterRisk("all")
  }


  // Analytics describe the analyses behind the reports, so they are computed from
  // the analysis rows rather than from `generated_reports`.
  const riskDistribution = [
    { name: "Low Risk", value: analyses.filter((a) => a.risk_level === "low").length, color: "#10b981" },
    { name: "Medium Risk", value: analyses.filter((a) => a.risk_level === "medium").length, color: "#f59e0b" },
    { name: "High Risk", value: analyses.filter((a) => a.risk_level === "high").length, color: "#ef4444" },
    { name: "Indeterminate", value: analyses.filter((a) => a.risk_level === "indeterminate").length, color: "#6b7280" },
  ]

  const diagnosisCount = analyses.reduce((acc, analysis) => {
    const diagnosis = analysis.diagnosis || "Unknown"
    acc[diagnosis] = (acc[diagnosis] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const diagnosisData = Object.entries(diagnosisCount).map(([name, value]) => ({ name, value }))

  const confidenceDistribution = [
    { range: "90-100%", count: analyses.filter((a) => a.confidence >= 0.9).length },
    { range: "80-89%", count: analyses.filter((a) => a.confidence >= 0.8 && a.confidence < 0.9).length },
    { range: "70-79%", count: analyses.filter((a) => a.confidence >= 0.7 && a.confidence < 0.8).length },
    { range: "<70%", count: analyses.filter((a) => a.confidence < 0.7).length },
  ]

  const timelineData = analyses.reduce((acc, analysis) => {
    const date = new Date(analysis.date).toLocaleDateString()
    if (!acc[date]) {
      acc[date] = { date, count: 0, lowRisk: 0, mediumRisk: 0, highRisk: 0 }
    }
    acc[date].count++
    if (analysis.risk_level === "low") acc[date].lowRisk++
    if (analysis.risk_level === "medium") acc[date].mediumRisk++
    if (analysis.risk_level === "high") acc[date].highRisk++
    return acc
  }, {} as Record<string, { date: string; count: number; lowRisk: number; mediumRisk: number; highRisk: number }>)

  const timelineArray = Object.values(timelineData).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Three empty states, each with exactly one action (D14, FR-039). The
  // analyses-but-no-reports case is deliberately absent: the second section is
  // already populated, and an empty card above it would contradict what is on
  // screen directly below.
  const showLoadError = loadFailed
  const showFirstRun = !loadFailed && rows.length === 0 && analyses.length === 0
  const showNoMatch =
    !loadFailed &&
    !showFirstRun &&
    filtersActive &&
    visibleReports.length === 0 &&
    visibleAnalyses.length === 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-background">
      {/* The only live region on this page. It carries one sentence, set once
          when a generation settles, so completion is announced exactly once
          (D19). The elapsed timer is deliberately outside it. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <PageHeader
        title="Reports"
        description="Generate, preview and download clinical reports from your analyses"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
      />

      {/* Analytics Charts */}
      {analyses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconChartPie className="h-5 w-5" aria-hidden="true" />
                Risk Level Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RiskDistributionChart data={riskDistribution} />
            </CardContent>
          </Card>

          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconChartBar className="h-5 w-5" aria-hidden="true" />
                Confidence Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConfidenceChart data={confidenceDistribution} />
            </CardContent>
          </Card>

          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconTrendingUp className="h-5 w-5" aria-hidden="true" />
                Analysis Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineChart data={timelineArray} />
            </CardContent>
          </Card>
        </div>
      )}

      {analyses.length > 0 && diagnosisData.length > 0 && (
        <Card className="bg-background border border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <IconChartBar className="h-5 w-5" aria-hidden="true" />
              Diagnosis Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiagnosisChart data={diagnosisData} />
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      {!showLoadError && !showFirstRun && (
        <Card className="bg-background border border-border relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <IconFilter className="h-5 w-5" aria-hidden="true" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <IconSearch
                    className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Search by report number or diagnosis..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-border"
                    aria-label="Search reports"
                  />
                </div>
              </div>

              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                aria-label="Filter analyses by risk level"
                className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="indeterminate">Indeterminate</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your reports (T055). Two renderings of one derived row set: a table at
          >=768px, stacked cards below it. Status leads on mobile because it is
          the one fact that decides whether the document is worth opening (D18). */}
      {visibleReports.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Your reports ({visibleReports.length})
          </h2>

          {/* >=768px: table. The date column is dropped between 768 and 1023 so
              the report number never has to truncate to fit. */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Your generated reports</caption>
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Report</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                  <th scope="col" className="hidden lg:table-cell px-4 py-3 text-left font-medium">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map(describeRow).map((view) => (
                  <tr key={view.row.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {view.row.report_number ?? formatReportType(view.row.report_type)}
                      {view.diagnosis && (
                        <div className="text-xs font-normal text-muted-foreground">
                          {view.diagnosis}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatReportType(view.row.report_type)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip presentation={view.presentation} />
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        {view.supporting}
                        {view.gaps && ` Missing: ${view.gaps}.`}
                      </p>
                      {view.waiting && (
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          Elapsed {formatElapsed(view.elapsed)}
                        </p>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {new Date(view.row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <RowActions view={view} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* <768px: stacked cards, status first, targets at least 44px. */}
          <div className="space-y-4 md:hidden">
            {visibleReports.map(describeRow).map((view) => (
              <Card key={view.row.id} className="bg-background border border-border">
                <CardContent className="space-y-3 p-4">
                  <StatusChip presentation={view.presentation} />

                  <div className="break-words font-medium text-foreground">
                    {view.row.report_number ?? formatReportType(view.row.report_type)}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{formatReportType(view.row.report_type)}</span>
                    <span className="flex items-center gap-1">
                      <IconCalendar className="h-4 w-4" aria-hidden="true" />
                      {new Date(view.row.created_at).toLocaleDateString()}
                    </span>
                    {view.diagnosis && <span>{view.diagnosis}</span>}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {view.supporting}
                    {view.gaps && ` Missing: ${view.gaps}.`}
                  </p>

                  {view.waiting && (
                    <p className="text-sm tabular-nums text-muted-foreground">
                      Elapsed {formatElapsed(view.elapsed)}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <RowActions view={view} touch />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Analyses without a report — the Generate action lives here (T055) */}
      {visibleAnalyses.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Analyses without a report ({visibleAnalyses.length})
          </h2>

          {visibleAnalyses.map((analysis) => {
            const record = analysisById.get(analysis.id)

            return (
              <Card
                key={analysis.id}
                className="bg-background border border-border hover:shadow-lg transition-shadow relative overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="relative w-full lg:w-32 h-32 bg-surface rounded-lg flex items-center justify-center overflow-hidden">
                      {analysis.imageUrl ? (
                        <Image
                          src={analysis.imageUrl}
                          alt={`Analysis ${analysis.shortId}`}
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      ) : (
                        <IconFileAnalytics
                          className="h-12 w-12 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Analysis #{analysis.shortId}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4" aria-hidden="true" />
                              {new Date(analysis.date).toLocaleDateString()}
                            </span>
                            <span>Image: {record?.image_name || "Unknown"}</span>
                          </div>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenGenerateDialog(analysis)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <IconFilePlus className="h-4 w-4 mr-1" aria-hidden="true" />
                          Generate Report
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Diagnosis</h4>
                          <p className="text-foreground font-medium">{analysis.diagnosis}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Confidence</h4>
                          <p className="text-foreground font-medium">
                            {(analysis.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Risk Level</h4>
                          <StatusBadge tone={riskTone(analysis.risk_level)} dot>
                            {(analysis.risk_level || "unknown").toUpperCase()}
                          </StatusBadge>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Analysis Time</h4>
                          <p className="text-foreground font-medium">{analysis.analysisTime}s</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {/* Load error — the records are fine, the read is not (FR-039) */}
      {showLoadError && (
        <Card className="bg-background border border-border">
          <CardContent className="p-6 sm:p-12 text-center">
            <IconFileAnalytics
              className="h-12 w-12 mx-auto mb-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Could not load your reports
            </h3>
            <p className="text-muted-foreground mb-6">
              Your reports are safe. This is a display problem.
            </p>
            <Button variant="default" onClick={() => router.refresh()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* First run — nothing to report on yet */}
      {showFirstRun && (
        <Card className="bg-background border border-border">
          <CardContent className="p-6 sm:p-12 text-center">
            <IconFileAnalytics
              className="h-12 w-12 mx-auto mb-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
            <p className="text-muted-foreground mb-6">
              Reports are generated from a skin analysis.
            </p>
            <Button asChild variant="default">
              <Link href="/dashboard/analysis">Analyse an image</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nothing matched — echo the term so it is clear what was searched for */}
      {showNoMatch && (
        <Card className="bg-background border border-border">
          <CardContent className="p-6 sm:p-12 text-center">
            <IconSearch
              className="h-12 w-12 mx-auto mb-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {term ? `Nothing matches “${searchTerm}”` : "Nothing matches these filters"}
            </h3>
            <p className="text-muted-foreground mb-6">
              Your reports are still here — none of them match what you are filtering for.
            </p>
            <Button variant="default" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {selectedAnalysis && (
        <GenerateReportDialog
          open={generateDialogOpen}
          onClose={() => setGenerateDialogOpen(false)}
          onGenerate={handleGenerateReport}
          analysisId={selectedAnalysis.id}
          diagnosis={selectedAnalysis.diagnosis}
          isGenerating={inFlight.size > 0}
        />
      )}

      {preview && (
        <ReportPreviewDialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          reportUrl={preview.url}
          reportTitle={preview.title}
          reportId={preview.id}
          onDownload={() => {
            const row = rows.find((candidate) => candidate.id === preview.id)
            if (row) handleDownloadReport(row)
          }}
        />
      )}
    </div>
  )
}
