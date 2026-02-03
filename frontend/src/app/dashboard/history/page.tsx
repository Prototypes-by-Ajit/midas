"use client"

export const dynamic = "force-dynamic"
export const revalidate = 0


import { useState } from "react"
import { useAnalytics } from "@/contexts/analytics-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {createClient}  from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface HistoryEntry {
  id: string
  timestamp: string
  diagnosis: string
  confidence: number
  risk_level: "low" | "medium" | "high"
  analysisTime: number // in seconds
  imageUrl: string
  imageName: string
  imageSize: string
  notes?: string
}

export default function HistoryPage() {
  const { analysisHistory, refreshData, deleteAnalysis } = useAnalytics()
  const router = useRouter()
  const supabase = createClient()

  // Convert analysis results to history format
  const history: HistoryEntry[] = analysisHistory.map((analysis) => ({
    id: analysis.id,
    timestamp: analysis.analysis_date,
    diagnosis: analysis.diagnosis,
    confidence: analysis.confidence,
    risk_level: analysis.risk_level,
    analysisTime: Math.round(analysis.processing_time / 1000), // Convert to seconds
    imageUrl: analysis.image_url,
    imageName: analysis.image_name,
    imageSize: "Unknown", // Would be better to store this
    notes: `${analysis.detected_features.length} features detected`
  }))
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRisk, setFilterRisk] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Function to fetch or generate report PDF
  const handleViewDetails = async (analysisId: string) => {
    try {
      setIsGeneratingReport(true)
      setSelectedEntry(analysisId)

      // Check if report already exists
      const { data: existingReports, error: fetchError } = await supabase
        .from('generated_reports')
        .select('id, storage_path, generation_status')
        .eq('analysis_id', analysisId)
        .eq('report_type', 'patient_report')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error fetching report:', fetchError)
      }

      let pdfUrl = null

      // If report exists and is completed, get signed URL
      if (existingReports && existingReports.length > 0 && existingReports[0].generation_status === 'completed') {
        const storagePath = existingReports[0].storage_path

        if (storagePath) {
          // Get signed URL from Supabase Storage
          const { data: signedUrlData, error: urlError } = await supabase
            .storage
            .from('report_storage')
            .createSignedUrl(storagePath, 3600) // 1 hour expiry

          if (!urlError && signedUrlData) {
            pdfUrl = signedUrlData.signedUrl
          }
        }
      }

      // If no existing report, generate new one
      if (!pdfUrl) {
        // Call Supabase Edge Function to generate report
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('User not authenticated')
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-report`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              analysis_id: analysisId,
              report_type: 'patient_report',
              user_id: user.id
            })
          }
        )

        if (!response.ok) {
          throw new Error('Failed to generate report')
        }

        const result = await response.json()

        if (result.success && result.pdf_url) {
          pdfUrl = result.pdf_url
        } else {
          throw new Error('Report generation failed')
        }
      }

      // Set the PDF URL to display in modal
      if (pdfUrl) {
        setReportUrl(pdfUrl)
      } else {
        throw new Error('Could not retrieve PDF URL')
      }

    } catch (error) {
      console.error('Error viewing details:', error)
      alert('Failed to load report. Please try again.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Function to export/download PDF
  const handleExportPDF = async (analysisId: string, imageName: string) => {
    try {
      setExportingId(analysisId)

      // Check if report already exists
      const { data: existingReports, error: fetchError } = await supabase
        .from('generated_reports')
        .select('id, storage_path, generation_status')
        .eq('analysis_id', analysisId)
        .eq('report_type', 'patient_report')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error fetching report:', fetchError)
      }

      let pdfUrl = null

      // If report exists and is completed, get signed URL
      if (existingReports && existingReports.length > 0 && existingReports[0].generation_status === 'completed') {
        const storagePath = existingReports[0].storage_path

        if (storagePath) {
          const { data: signedUrlData, error: urlError } = await supabase
            .storage
            .from('report_storage')
            .createSignedUrl(storagePath, 3600)

          if (!urlError && signedUrlData) {
            pdfUrl = signedUrlData.signedUrl
          }
        }
      }

      // If no existing report, generate new one
      if (!pdfUrl) {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('User not authenticated')
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-report`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              analysis_id: analysisId,
              report_type: 'patient_report',
              user_id: user.id
            })
          }
        )

        if (!response.ok) {
          throw new Error('Failed to generate report')
        }

        const result = await response.json()

        if (result.success && result.pdf_url) {
          pdfUrl = result.pdf_url
        } else {
          throw new Error('Report generation failed')
        }
      }

      // Download the PDF
      if (pdfUrl) {
        const link = document.createElement('a')
        link.href = pdfUrl
        link.download = `MIDAS_Report_${imageName.replace(/\.[^/.]+$/, '')}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        throw new Error('Could not retrieve PDF URL')
      }

    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExportingId(null)
    }
  }

  // Close modal
  const closeModal = () => {
    setSelectedEntry(null)
    setReportUrl(null)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"  
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
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
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-black dark:text-white">Analysis History</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View your complete analysis history and track your usage patterns
          </p>
        </div>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ALL ${history.length} analysis records?\n\nThis action cannot be undone.`)) {
                history.forEach(entry => deleteAnalysis(entry.id))
              }
            }}
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400 dark:hover:text-white"
          >
            <IconTrash className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Analyses</CardTitle>
            <IconScanEye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">{history.length}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</CardTitle>
            <IconCalendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">{thisWeekCount}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Analyses performed</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Analysis Time</CardTitle>
            <IconClock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {history.length > 0 ? `${avgAnalysisTime.toFixed(1)}s` : "--"}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Processing time</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Confidence</CardTitle>
            <IconHistory className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {history.length > 0 ? `${(avgConfidence * 100).toFixed(1)}%` : "--"}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Model accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-black dark:text-white flex items-center gap-2">
            <IconSearch className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by diagnosis, entry ID, or image name..."
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
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm text-black dark:text-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="confidence">By Confidence</option>
              <option value="diagnosis">By Diagnosis</option>
            </select>

            <Button 
              variant="outline"
              onClick={refreshData}
              className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
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

          return (
            <Card key={entry.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Timeline Indicator */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <IconHistory className="h-6 w-6 text-gray-500" />
                    </div>
                  </div>

                  {/* Entry Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-black dark:text-white">
                            {entry.diagnosis}
                          </h3>
                          <Badge className={getRiskColor(entry.risk_level)}>
                            {(entry.risk_level || "unknown").toUpperCase()} RISK
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(entry.id)}
                          disabled={isGeneratingReport && selectedEntry === entry.id}
                          className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
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
                          onClick={() => handleExportPDF(entry.id, entry.imageName)}
                          disabled={exportingId === entry.id}
                          className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete this analysis?\n\nDiagnosis: ${entry.diagnosis}\nDate: ${dateTime.date} ${dateTime.time}`)) {
                              deleteAnalysis(entry.id)
                            }
                          }}
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400 dark:hover:text-white"
                        >
                          <IconTrash className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Confidence Score
                        </h4>
                        <p className="text-lg font-semibold text-black dark:text-white">
                          {(entry.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Analysis Time
                        </h4>
                        <p className="text-lg font-semibold text-black dark:text-white">
                          {entry.analysisTime}s
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Entry ID
                        </h4>
                        <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                          {entry.id}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Status
                        </h4>
                        <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
                          COMPLETED
                        </Badge>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Clinical Notes
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
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
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardContent className="p-12 text-center">
            <IconHistory className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-black dark:text-white mb-2">
              {history.length === 0 ? "No analysis history yet" : "No history found"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {history.length === 0
                ? "Your analysis history will appear here once you start using MIDAS AI"
                : "No analyses match your current search criteria"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* PDF Viewer Modal */}
      {reportUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full h-full max-w-7xl max-h-[95vh] m-4">
            {/* Modal Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 p-4 rounded-t-lg">
              <div className="flex items-center gap-3">
                <IconFileTypePdf className="h-6 w-6 text-red-500" />
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  Medical Analysis Report
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = reportUrl
                    link.download = 'MIDAS_Report.pdf'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                >
                  <IconDownload className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeModal}
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400 dark:hover:text-white"
                >
                  <IconX className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>

            {/* PDF Iframe */}
            <div className="w-full h-full pt-16 pb-4">
              <iframe
                src={reportUrl}
                className="w-full h-full rounded-b-lg border border-gray-200 dark:border-gray-800 bg-white"
                title="Medical Analysis Report"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}