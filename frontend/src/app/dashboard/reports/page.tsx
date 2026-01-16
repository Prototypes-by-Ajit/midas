"use client"

import { useState } from "react"
import Image from "next/image"
import { useAnalytics } from "@/contexts/analytics-context"
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
import { useToast } from "@/components/hooks/use-toast"
import { GenerateReportDialog, type ReportConfig } from "@/components/generate-report-dialog"
import { ReportPreviewDialog } from "@/components/report-preview-dialog"
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts"

// Convert AnalysisResult to Report format for backwards compatibility
interface Report {
  id: string
  shortId: string
  date: string
  diagnosis: string
  confidence: number
  risk_level: "low" | "medium" | "high"
  status: "completed" | "pending" | "reviewed"
  imageUrl: string
  analysisTime: number
  imageSize: string
  notes?: string
  // Report generation fields
  hasGeneratedReport?: boolean
  reportUrl?: string
  reportGenerationStatus?: "not_generated" | "generating" | "completed" | "failed"
}

export default function ReportsPage() {
  const { analysisHistory } = useAnalytics()
  
  // Convert analysis results to report format
  const reports: Report[] = analysisHistory.map((analysis) => ({
    id: analysis.id,
    shortId: analysis.id.slice(0, 8),
    date: analysis.analysis_date,
    diagnosis: analysis.diagnosis,
    confidence: analysis.confidence,
    risk_level: analysis.risk_level,
    status: "completed" as const, // All completed analyses are reports
    imageUrl: analysis.image_url,
    analysisTime: Math.round(analysis.processing_time / 1000), // Convert to seconds
    imageSize: "Unknown", // Would be better to store this in analysis
    notes: `Analysis completed with ${analysis.detected_features.length} detected features`
  }))
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRisk, setFilterRisk] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Dialog states
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set())
  const { toast } = useToast()

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

      toast({
        title: "Report Generated",
        description: "Your medical report has been generated successfully.",
      })

      setGenerateDialogOpen(false)
    } catch (error) {
      console.error('Error generating report:', error)
      setReportStatuses(prev => ({
        ...prev,
        [selectedReport.id]: { status: "failed" }
      }))

      toast({
        title: "Generation Failed",
        description: "Failed to generate report. Please try again.",
        variant: "destructive"
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

        toast({
          title: "Download Complete",
          description: "Your report has been downloaded successfully.",
        })
      } catch (error) {
        console.error('Error downloading report:', error)
        toast({
          title: "Download Failed",
          description: "Failed to download report. Please try again.",
          variant: "destructive"
        })
      }
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "reviewed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "pending": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
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
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">Reports</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your AI analysis reports and diagnostic summaries
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Reports</CardTitle>
            <IconFileAnalytics className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">{reports.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">High Risk</CardTitle>
            <IconAlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {reports.filter(r => r.risk_level === "high").length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Review</CardTitle>
            <IconCalendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {reports.filter(r => r.status === "pending").length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</CardTitle>
            <IconCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {reports.filter(r => r.status === "completed" || r.status === "reviewed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      {reports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Risk Distribution Pie Chart */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconChartPie className="h-5 w-5" />
                Risk Level Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Distribution Bar Chart */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconChartBar className="h-5 w-5" />
                Confidence Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={confidenceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Analysis Timeline */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconTrendingUp className="h-5 w-5" />
                Analysis Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timelineArray}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diagnosis Breakdown */}
      {reports.length > 0 && diagnosisData.length > 0 && (
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-black dark:text-white flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Diagnosis Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={150} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-black dark:text-white flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by report ID or diagnosis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>
            
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="flex h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm text-black dark:text-white"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm text-black dark:text-white"
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
          <Card key={report.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Image Display */}
                <div className="relative w-full lg:w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {report.imageUrl ? (
                    <Image
                      src={report.imageUrl}
                      alt={`Analysis ${report.shortId}`}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  ) : (
                    <IconFileAnalytics className="h-12 w-12 text-gray-400" />
                  )}
                </div>

                {/* Report Details */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-black dark:text-white">
                          Report #{report.shortId}
                        </h3>
                        <Badge className={getStatusColor(report.status)}>
                          {report.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                              className="border-gray-300 dark:border-gray-700"
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
                                className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                              >
                                <IconEye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReport(report)}
                                className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
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
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Diagnosis</h4>
                      <p className="text-black dark:text-white font-medium">{report.diagnosis}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Confidence</h4>
                      <p className="text-black dark:text-white font-medium">
                        {(report.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Level</h4>
                      <Badge className={getRiskColor(report.risk_level)}>
                        {(report.risk_level || "unknown").toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Analysis Time</h4>
                      <p className="text-black dark:text-white font-medium">
                        {report.analysisTime}s
                      </p>
                    </div>
                  </div>
                  
                  {analysis && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Detected Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.detected_features.slice(0, 4).map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {analysis.detected_features.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{analysis.detected_features.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {filteredReports.length === 0 && (
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardContent className="p-12 text-center">
            <IconFileAnalytics className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-black dark:text-white mb-2">
              {reports.length === 0 ? "No reports yet" : "No reports found"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {reports.length === 0
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
