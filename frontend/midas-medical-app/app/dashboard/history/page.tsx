"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Extended mock data for history
const mockHistoryData = [
  {
    id: "AN2024001",
    imageUrl: "/placeholder-1imk9.png",
    date: "2024-01-15",
    time: "14:30",
    status: "completed",
    result: "Benign Nevus",
    confidence: 94,
    doctorReviewed: false,
  },
  {
    id: "AN2024002",
    imageUrl: "/placeholder-h5lmy.png",
    date: "2024-01-10",
    time: "09:15",
    status: "reviewed",
    result: "Melanoma",
    confidence: 87,
    doctorReviewed: true,
    doctorName: "Dr. Sarah Johnson",
  },
  {
    id: "AN2024003",
    imageUrl: "/placeholder-2bwsx.png",
    date: "2024-01-05",
    time: "16:45",
    status: "completed",
    result: "Basal Cell Carcinoma",
    confidence: 91,
    doctorReviewed: false,
  },
  {
    id: "AN2024004",
    imageUrl: "/placeholder-fbpf6.png",
    date: "2024-01-01",
    time: "11:20",
    status: "completed",
    result: "Benign Keratosis",
    confidence: 96,
    doctorReviewed: false,
  },
  {
    id: "AN2023050",
    imageUrl: "/skin-check-routine.jpg",
    date: "2023-12-28",
    time: "13:10",
    status: "completed",
    result: "Actinic Keratosis",
    confidence: 89,
    doctorReviewed: true,
    doctorName: "Dr. Michael Chen",
  },
]

export default function AnalysisHistory() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-desc")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary text-primary-foreground"
      case "reviewed":
        return "bg-secondary text-secondary-foreground"
      case "pending":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getResultColor = (result: string) => {
    const highRisk = ["Melanoma", "Squamous Cell Carcinoma"]
    const mediumRisk = ["Basal Cell Carcinoma", "Actinic Keratosis"]

    if (highRisk.includes(result)) {
      return "text-destructive"
    } else if (mediumRisk.includes(result)) {
      return "text-orange-600"
    }
    return "text-primary"
  }

  const filteredData = mockHistoryData.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.result.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">M</span>
                </div>
                <span className="text-xl font-bold text-foreground">MIDAS</span>
              </Link>
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
                <Link href="/dashboard/history" className="text-primary font-medium">
                  History
                </Link>
                <Link href="/dashboard/profile" className="text-muted-foreground hover:text-foreground">
                  Profile
                </Link>
                <Link href="/help" className="text-muted-foreground hover:text-foreground">
                  Help
                </Link>
                <Link href="/chat" className="text-muted-foreground hover:text-foreground">
                  AI Chat
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                Settings
              </Button>
              <Button variant="ghost" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Analysis History</h1>
            <p className="text-muted-foreground">View and manage all your skin analysis results</p>
          </div>
          <Button>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by ID or diagnosis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="reviewed">Doctor Reviewed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="confidence-desc">Highest Confidence</SelectItem>
                  <SelectItem value="confidence-asc">Lowest Confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results ({filteredData.length})</CardTitle>
            <CardDescription>Click on any analysis to view detailed report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredData.map((analysis) => (
                <div
                  key={analysis.id}
                  className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <img
                    src={analysis.imageUrl || "/placeholder.svg"}
                    alt="Analysis"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-foreground">ID: {analysis.id}</p>
                      <Badge className={getStatusColor(analysis.status)}>{analysis.status}</Badge>
                      {analysis.doctorReviewed && (
                        <Badge variant="outline" className="text-xs">
                          Doctor Reviewed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                      <span>{analysis.date}</span>
                      <span>{analysis.time}</span>
                      {analysis.doctorName && <span>by {analysis.doctorName}</span>}
                    </div>
                    <p className={`text-sm font-medium ${getResultColor(analysis.result)}`}>
                      {analysis.result} ({analysis.confidence}% confidence)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      View Report
                    </Button>
                    <Button variant="ghost" size="sm">
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
