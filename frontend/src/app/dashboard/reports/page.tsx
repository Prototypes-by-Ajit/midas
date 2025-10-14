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
  IconCheck
} from "@tabler/icons-react"

// Convert AnalysisResult to Report format for backwards compatibility
interface Report {
  id: string
  date: string
  diagnosis: string
  confidence: number
  risk_level: "low" | "medium" | "high"
  status: "completed" | "pending" | "reviewed"
  imageUrl: string
  analysisTime: number
  imageSize: string
  notes?: string
}

export default function ReportsPage() {
  const { analysisHistory } = useAnalytics()
  
  // Convert analysis results to report format
  const reports: Report[] = analysisHistory.map((analysis) => ({
    id: analysis.id.slice(0, 8), // Short ID for display
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
    const matchesSearch = report.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRisk = filterRisk === "all" || report.risk_level === filterRisk
    const matchesStatus = filterStatus === "all" || report.status === filterStatus

    return matchesSearch && matchesRisk && matchesStatus
  })

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
          const analysis = analysisHistory.find(a => a.id.slice(0, 8) === report.id)
          
          return (
          <Card key={report.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Image Display */}
                <div className="relative w-full lg:w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {report.imageUrl ? (
                    <Image
                      src={report.imageUrl}
                      alt={`Analysis ${report.id}`}
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
                          Report #{report.id}
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                      >
                        <IconEye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                      >
                        <IconDownload className="h-4 w-4 mr-1" />
                        Download
                      </Button>
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
                        {report.risk_level.toUpperCase()}
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
    </div>
  )
}