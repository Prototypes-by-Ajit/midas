"use client"



import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  IconClock,
  IconAlertTriangle,
  IconCheck,
  IconChartPie,
  IconChartBar,
  IconTrendingUp,
  IconFilePlus
} from "@tabler/icons-react"
import { toast } from "sonner"
import { GenerateReportDialog, type ReportConfig } from "@/components/generate-report-dialog"
import { ReportPreviewDialog } from "@/components/report-preview-dialog"
import dynamic from "next/dynamic"
import type { AnalysisRecord, ReportRow as Report } from "@/types/dashboard"

// recharts is lazy-loaded: it is ~100 kB and none of these render until the
// account actually has reports. Each fallback reserves the chart's exact height
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
 * Report list and generation. `reports` and `analysisHistory` are shaped by the
 * server page — previously both were derived in this render body from the
 * browser-side `AnalyticsContext`, so the list was empty on first paint.
 */
export default function ReportsConsole({
  reports,
  analysisHistory,
  loadFailed,
}: {
  reports: Report[]
  analysisHistory: AnalysisRecord[]
  loadFailed: boolean
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRisk, setFilterRisk] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Dialog states
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set())

  // Report generation status (mock for now - will be from API)
  const [reportStatuses, setReportStatuses] = useState<Record<string, {
    status: "not_generated" | "generating" | "completed" | "failed"
    url?: string
    reportId?: string
  }>>({})

  // Handle generate report button click
  const handleOpenGenerateDialog = (report: Report) => {
    setSelectedReport(report)
    setGenerateDialogOpen(true)
  }

  // Handle report generation
  const handleGenerateReport = async (config: ReportConfig) => {
    if (!selectedReport) return

    // Add to generating set
    setGeneratingReports(prev => new Set(prev).add(selectedReport.id))
    setReportStatuses(prev => ({
      ...prev,
      [selectedReport.id]: { status: "generating" }
    }))

    try {
      // Call API to generate report
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: selectedReport.id,
          config
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Report generation error:', response.status, errorData)
        const errorMessage = errorData.details
          ? `${errorData.error || 'Error'}: ${errorData.details}`
          : errorData.error || 'Failed to generate report'
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Set as completed with actual URL from API
      setReportStatuses(prev => ({
        ...prev,
        [selectedReport.id]: {
          status: "completed",
          url: data.preview_url || data.report_url,
          reportId: data.report_id
        }
      }))

      toast.success("Report Generated", {
        description: "Your medical report has been generated successfully.",
      })

      setGenerateDialogOpen(false)
    } catch (error) {
      console.error('Error generating report:', error)
      setReportStatuses(prev => ({
        ...prev,
        [selectedReport.id]: { status: "failed" }
      }))

      toast.error("Generation Failed", {
        description: "Failed to generate report. Please try again.",
      })
    } finally {
      // Remove from generating set
      setGeneratingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedReport.id)
        return newSet
      })
    }
  }

  // Handle preview report
  const handlePreviewReport = (report: Report) => {
    const reportStatus = reportStatuses[report.id]
    if (reportStatus?.status === "completed" && reportStatus.url) {
      setSelectedReport(report)
      setPreviewDialogOpen(true)
    }
  }

  // Handle download report
  const handleDownloadReport = async (report: Report) => {
    const reportStatus = reportStatuses[report.id]
    if (reportStatus?.status === "completed" && reportStatus.url) {
      try {
        // Call API to get download URL with proper headers
        const reportId = reportStatus.reportId
        if (!reportId) {
          throw new Error('Report ID missing')
        }
        const response = await fetch(`/api/reports/${reportId}/download`)

        if (!response.ok) {
          throw new Error('Failed to download report')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `MIDAS-Report-${report.shortId}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast.success("Download Complete", {
          description: "Your report has been downloaded successfully.",
        })
      } catch (error) {
        console.error('Error downloading report:', error)
        toast.error("Download Failed", {
          description: "Failed to download report. Please try again.",
        })
      }
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-success-subtle text-success"
      case "medium": return "bg-warning-subtle text-warning"
      case "high": return "bg-critical-subtle text-critical"
      default: return "bg-surface text-foreground dark:bg-surface"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-primary-subtle text-primary"
      case "reviewed": return "bg-success-subtle text-success"
      case "pending": return "bg-warning-subtle text-warning"
      default: return "bg-surface text-foreground dark:bg-surface"
    }
  }

  const filteredReports = reports.filter(report => {
    const diagnosis = report.diagnosis || "Unknown"
    const matchesSearch = diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRisk = filterRisk === "all" || report.risk_level === filterRisk
    const matchesStatus = filterStatus === "all" || report.status === filterStatus

    return matchesSearch && matchesRisk && matchesStatus
  })

  // Analytics Data
  const riskDistribution = [
    { name: "Low Risk", value: reports.filter(r => r.risk_level === "low").length, color: "#10b981" },
    { name: "Medium Risk", value: reports.filter(r => r.risk_level === "medium").length, color: "#f59e0b" },
    { name: "High Risk", value: reports.filter(r => r.risk_level === "high").length, color: "#ef4444" },
  ]

  const diagnosisCount = reports.reduce((acc, report) => {
    const diagnosis = report.diagnosis || "Unknown"
    acc[diagnosis] = (acc[diagnosis] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const diagnosisData = Object.entries(diagnosisCount).map(([name, value]) => ({ name, value }))

  const confidenceDistribution = [
    { range: "90-100%", count: reports.filter(r => r.confidence >= 0.9).length },
    { range: "80-89%", count: reports.filter(r => r.confidence >= 0.8 && r.confidence < 0.9).length },
    { range: "70-79%", count: reports.filter(r => r.confidence >= 0.7 && r.confidence < 0.8).length },
    { range: "<70%", count: reports.filter(r => r.confidence < 0.7).length },
  ]

  // Timeline data - group by date
  const timelineData = reports.reduce((acc, report) => {
    const date = new Date(report.date).toLocaleDateString()
    if (!acc[date]) {
      acc[date] = { date, count: 0, lowRisk: 0, mediumRisk: 0, highRisk: 0 }
    }
    acc[date].count++
    if (report.risk_level === "low") acc[date].lowRisk++
    if (report.risk_level === "medium") acc[date].mediumRisk++
    if (report.risk_level === "high") acc[date].highRisk++
    return acc
  }, {} as Record<string, any>)

  const timelineArray = Object.values(timelineData).sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">
          View and manage your AI analysis reports and diagnostic summaries
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-background border border-border relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
            <IconFileAnalytics className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{reports.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            <IconAlertTriangle className="h-4 w-4 text-critical" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {reports.filter(r => r.risk_level === "high").length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <IconCalendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {reports.filter(r => r.status === "pending").length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <IconCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {reports.filter(r => r.status === "completed" || r.status === "reviewed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      {reports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Risk Distribution Pie Chart */}
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconChartPie className="h-5 w-5" />
                Risk Level Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RiskDistributionChart data={riskDistribution} />
            </CardContent>
          </Card>

          {/* Confidence Distribution Bar Chart */}
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconChartBar className="h-5 w-5" />
                Confidence Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConfidenceChart data={confidenceDistribution} />
            </CardContent>
          </Card>

          {/* Analysis Timeline */}
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconTrendingUp className="h-5 w-5" />
                Analysis Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineChart data={timelineArray} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diagnosis Breakdown */}
      {reports.length > 0 && diagnosisData.length > 0 && (
        <Card className="bg-background border border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Diagnosis Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiagnosisChart data={diagnosisData} />
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="bg-background border border-border relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by report ID or diagnosis..."
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
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
          <div className="space-y-4">
        {filteredReports.map((report) => {
          const analysis = analysisHistory.find(a => a.id === report.id)
          
          return (
          <Card key={report.id} className="bg-background border border-border hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Image Display */}
                <div className="relative w-full lg:w-32 h-32 bg-surface rounded-lg flex items-center justify-center overflow-hidden">
                  {report.imageUrl ? (
                    <Image
                      src={report.imageUrl}
                      alt={`Analysis ${report.shortId}`}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  ) : (
                    <IconFileAnalytics className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                {/* Report Details */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          Report #{report.shortId}
                        </h3>
                        <Badge className={getStatusColor(report.status)}>
                          {report.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <IconCalendar className="h-4 w-4" />
                          <span>{new Date(report.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconClock className="h-4 w-4" />
                          <span>{new Date(report.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Image: {analysis?.image_name || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Show different buttons based on report generation status */}
                      {(() => {
                        const reportStatus = reportStatuses[report.id]
                        const isGenerating = generatingReports.has(report.id)

                        if (!reportStatus || reportStatus.status === "not_generated") {
                          // Report not generated yet
                          return (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleOpenGenerateDialog(report)}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <IconFilePlus className="h-4 w-4 mr-1" />
                              Generate Report
                            </Button>
                          )
                        }

                        if (reportStatus.status === "generating" || isGenerating) {
                          // Report is being generated
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="border-border"
                            >
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Generating...
                            </Button>
                          )
                        }

                        if (reportStatus.status === "completed") {
                          // Report generated successfully
                          return (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreviewReport(report)}
                                className="border-black text-foreground hover:bg-background hover:text-white dark:hover:bg-card dark:hover:text-foreground"
                              >
                                <IconEye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReport(report)}
                                className="border-black text-foreground hover:bg-background hover:text-white dark:hover:bg-card dark:hover:text-foreground"
                              >
                                <IconDownload className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </>
                          )
                        }

                        if (reportStatus.status === "failed") {
                          // Report generation failed
                          return (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleOpenGenerateDialog(report)}
                            >
                              <IconFilePlus className="h-4 w-4 mr-1" />
                              Retry Generation
                            </Button>
                          )
                        }

                        return null
                      })()}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Diagnosis</h4>
                      <p className="text-foreground font-medium">{report.diagnosis}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Confidence</h4>
                      <p className="text-foreground font-medium">
                        {(report.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Risk Level</h4>
                      <Badge className={getRiskColor(report.risk_level)}>
                        {(report.risk_level || "unknown").toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Analysis Time</h4>
                      <p className="text-foreground font-medium">
                        {report.analysisTime}s
                      </p>
                    </div>
                  </div>
                  
                </div>
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {filteredReports.length === 0 && (
        <Card className="bg-background border border-border">
          <CardContent className="p-6 sm:p-12 text-center">
            <IconFileAnalytics className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {loadFailed
                ? "Could not load your reports"
                : reports.length === 0
                  ? "No reports yet"
                  : "No reports found"}
            </h3>
            <p className="text-muted-foreground">
              {loadFailed
                ? "Your records could not be read just now, and nothing has been lost. Reload to try again."
                : reports.length === 0
                  ? "Your analysis reports will appear here once you start using MIDAS AI"
                  : "Try adjusting your search criteria or filters"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {selectedReport && (
        <>
          <GenerateReportDialog
            open={generateDialogOpen}
            onClose={() => setGenerateDialogOpen(false)}
            onGenerate={handleGenerateReport}
            analysisId={selectedReport.id}
            diagnosis={selectedReport.diagnosis}
            isGenerating={generatingReports.has(selectedReport.id)}
          />

          <ReportPreviewDialog
            open={previewDialogOpen}
            onClose={() => setPreviewDialogOpen(false)}
            reportUrl={reportStatuses[selectedReport.id]?.url || ""}
            reportTitle={`Medical Report - ${selectedReport.diagnosis}`}
            reportId={reportStatuses[selectedReport.id]?.reportId || selectedReport.shortId}
            onDownload={() => handleDownloadReport(selectedReport)}
          />
        </>
      )}
    </div>
  )
}