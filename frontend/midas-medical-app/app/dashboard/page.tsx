"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ImageUpload } from "@/components/image-upload"

// Mock data for demonstration
const mockAnalyses = [
  {
    id: "AN2024001",
    imageUrl: "/placeholder-1imk9.png",
    date: "2024-01-15",
    status: "completed",
    result: "Benign Nevus",
    confidence: 94,
  },
  {
    id: "AN2024002",
    imageUrl: "/placeholder-h5lmy.png",
    date: "2024-01-10",
    status: "reviewed",
    result: "Melanoma",
    confidence: 87,
  },
  {
    id: "AN2024003",
    imageUrl: "/placeholder-2bwsx.png",
    date: "2024-01-05",
    status: "completed",
    result: "Basal Cell Carcinoma",
    confidence: 91,
  },
  {
    id: "AN2024004",
    imageUrl: "/placeholder-fbpf6.png",
    date: "2024-01-01",
    status: "completed",
    result: "Benign Keratosis",
    confidence: 96,
  },
]

export default function PatientDashboard() {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    // TODO: Handle file upload
    console.log("Files dropped:", files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // TODO: Handle file upload
    console.log("Files selected:", files)
  }

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
                <Link href="/dashboard" className="text-primary font-medium">
                  Dashboard
                </Link>
                <Link href="/dashboard/history" className="text-muted-foreground hover:text-foreground">
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, John Smith</h1>
          <p className="text-muted-foreground">Monitor your skin health with AI-powered analysis</p>
        </div>

        {/* Quick Upload Section */}
        <div className="mb-8">
          <ImageUpload />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Analyses */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Analyses</CardTitle>
                  <Link href="/dashboard/history">
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockAnalyses.map((analysis) => (
                    <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                      <div className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                        <img
                          src={analysis.imageUrl || "/placeholder.svg"}
                          alt="Analysis"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-medium text-foreground">ID: {analysis.id}</p>
                            <Badge className={getStatusColor(analysis.status)}>{analysis.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">Date: {analysis.date}</p>
                          <p className={`text-sm font-medium ${getResultColor(analysis.result)}`}>
                            {analysis.result} ({analysis.confidence}% confidence)
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Report
                        </Button>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats & Actions */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Scans</span>
                  <span className="text-2xl font-bold text-foreground">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Check</span>
                  <span className="text-sm font-medium text-foreground">2 days ago</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Next Recommended</span>
                  <span className="text-sm font-medium text-primary">In 28 days</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Health Score</span>
                    <span className="text-sm font-medium text-foreground">85/100</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-transparent" variant="outline">
                  Schedule Appointment
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  Share with Doctor
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  Download Reports
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  Educational Resources
                </Button>
              </CardContent>
            </Card>

            {/* Health Reminder */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">Health Reminder</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground mb-3">
                  Regular skin checks are recommended every 3 months for early detection.
                </p>
                <Button size="sm" className="w-full">
                  Set Reminder
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
