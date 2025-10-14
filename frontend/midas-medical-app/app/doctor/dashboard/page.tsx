"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for doctor dashboard
const mockPendingReviews = [
  {
    id: "AN2024005",
    patientId: "P001234",
    patientName: "John Smith",
    age: 45,
    gender: "M",
    imageUrl: "/placeholder.svg?height=60&width=60",
    aiResult: "Melanoma",
    confidence: 87,
    priority: "urgent",
    submittedAt: "2024-01-15T14:30:00Z",
    bodyLocation: "Back",
  },
  {
    id: "AN2024006",
    patientId: "P001235",
    patientName: "Mary Jones",
    age: 32,
    gender: "F",
    imageUrl: "/placeholder.svg?height=60&width=60",
    aiResult: "Benign Nevus",
    confidence: 94,
    priority: "regular",
    submittedAt: "2024-01-15T12:15:00Z",
    bodyLocation: "Arm",
  },
  {
    id: "AN2024007",
    patientId: "P001236",
    patientName: "Robert Brown",
    age: 58,
    gender: "M",
    imageUrl: "/placeholder.svg?height=60&width=60",
    aiResult: "Basal Cell Carcinoma",
    confidence: 91,
    priority: "regular",
    submittedAt: "2024-01-15T10:45:00Z",
    bodyLocation: "Face",
  },
]

const mockRecentPatients = [
  {
    id: "P001234",
    name: "John Smith",
    age: 45,
    lastVisit: "2024-01-10",
    totalScans: 3,
    riskLevel: "high",
  },
  {
    id: "P001235",
    name: "Mary Jones",
    age: 32,
    lastVisit: "2024-01-08",
    totalScans: 1,
    riskLevel: "low",
  },
]

export default function DoctorDashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive text-destructive-foreground"
      case "regular":
        return "bg-secondary text-secondary-foreground"
      case "follow-up":
        return "bg-primary text-primary-foreground"
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

  const filteredReviews = mockPendingReviews.filter((review) => {
    const matchesSearch =
      review.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.patientId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPriority = priorityFilter === "all" || review.priority === priorityFilter
    return matchesSearch && matchesPriority
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
              <span className="text-sm text-muted-foreground">Doctor Portal</span>
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/doctor/dashboard" className="text-primary font-medium">
                  Dashboard
                </Link>
                <Link href="/doctor/patients" className="text-muted-foreground hover:text-foreground">
                  Patients
                </Link>
                <Link href="/doctor/reports" className="text-muted-foreground hover:text-foreground">
                  Reports
                </Link>
                <Link href="/doctor/analytics" className="text-muted-foreground hover:text-foreground">
                  Analytics
                </Link>
                <Link href="/doctor/chat" className="text-muted-foreground hover:text-foreground">
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dr. Sarah Johnson</h1>
          <p className="text-muted-foreground">Dermatology Department - General Hospital</p>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-foreground">16</span>
                <Badge className="bg-destructive text-destructive-foreground">3 Urgent</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">12</div>
              <p className="text-sm text-muted-foreground">Avg. 4.2 min/review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">89</div>
              <p className="text-sm text-muted-foreground">+5 this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accuracy Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">94.3%</div>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending">Pending Reviews</TabsTrigger>
            <TabsTrigger value="patients">Recent Patients</TabsTrigger>
            <TabsTrigger value="analytics">Quick Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by patient name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Pending Reviews List */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Reviews ({filteredReviews.length})</CardTitle>
                <CardDescription>Cases requiring your clinical review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredReviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={review.imageUrl || "/placeholder.svg"}
                        alt="Lesion"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-foreground">
                            {review.patientName} ({review.age}
                            {review.gender})
                          </p>
                          <Badge className={getPriorityColor(review.priority)}>{review.priority}</Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                          <span>ID: {review.patientId}</span>
                          <span>Location: {review.bodyLocation}</span>
                          <span>{new Date(review.submittedAt).toLocaleDateString()}</span>
                        </div>
                        <p className={`text-sm font-medium ${getResultColor(review.aiResult)}`}>
                          AI: {review.aiResult} ({review.confidence}% confidence)
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link href={`/doctor/review/${review.id}`}>
                          <Button size="sm">Review</Button>
                        </Link>
                        <Button variant="ghost" size="sm">
                          Patient History
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Patients</CardTitle>
                <CardDescription>Patients you've recently reviewed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRecentPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Age: {patient.age} | Last Visit: {patient.lastVisit}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Scans: {patient.totalScans}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          className={
                            patient.riskLevel === "high"
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground"
                          }
                        >
                          {patient.riskLevel} risk
                        </Badge>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cases Reviewed</span>
                      <span className="font-medium">47</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg. Review Time</span>
                      <span className="font-medium">4.2 min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Agreement with AI</span>
                      <span className="font-medium">89%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Critical Cases Found</span>
                      <span className="font-medium text-destructive">3</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Case Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Benign Cases</span>
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Suspicious Cases</span>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Malignant Cases</span>
                      <span className="text-sm font-medium">10%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button>Generate Weekly Report</Button>
              <Button variant="outline">Search Patient</Button>
              <Button variant="outline">View Department Analytics</Button>
              <Button variant="outline">Export Data</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
