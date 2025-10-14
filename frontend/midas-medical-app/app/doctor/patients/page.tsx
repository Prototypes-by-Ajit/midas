"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock patient data
const mockPatients = [
  {
    id: "P001234",
    name: "John Smith",
    age: 45,
    gender: "M",
    email: "john.smith@email.com",
    phone: "+1-555-0123",
    lastVisit: "2024-01-15",
    totalScans: 3,
    riskLevel: "high",
    status: "active",
    recentDiagnosis: "Melanoma",
  },
  {
    id: "P001235",
    name: "Mary Jones",
    age: 32,
    gender: "F",
    email: "mary.jones@email.com",
    phone: "+1-555-0124",
    lastVisit: "2024-01-12",
    totalScans: 1,
    riskLevel: "low",
    status: "active",
    recentDiagnosis: "Benign Nevus",
  },
  {
    id: "P001236",
    name: "Robert Brown",
    age: 58,
    gender: "M",
    email: "robert.brown@email.com",
    phone: "+1-555-0125",
    lastVisit: "2024-01-10",
    totalScans: 5,
    riskLevel: "moderate",
    status: "follow-up",
    recentDiagnosis: "Basal Cell Carcinoma",
  },
]

export default function DoctorPatients() {
  const [searchTerm, setSearchTerm] = useState("")
  const [riskFilter, setRiskFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-destructive text-destructive-foreground"
      case "moderate":
        return "bg-orange-100 text-orange-800"
      case "low":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground"
      case "follow-up":
        return "bg-secondary text-secondary-foreground"
      case "discharged":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const filteredPatients = mockPatients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRisk = riskFilter === "all" || patient.riskLevel === riskFilter
    const matchesStatus = statusFilter === "all" || patient.status === statusFilter
    return matchesSearch && matchesRisk && matchesStatus
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
                <Link href="/doctor/dashboard" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
                <Link href="/doctor/patients" className="text-primary font-medium">
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
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Patient Management</h1>
            <p className="text-muted-foreground">Manage and review your assigned patients</p>
          </div>
          <Button>Add New Patient</Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="moderate">Moderate Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Patient List */}
        <Card>
          <CardHeader>
            <CardTitle>Patients ({filteredPatients.length})</CardTitle>
            <CardDescription>Your assigned patients and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {patient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-foreground">
                        {patient.name} ({patient.age}
                        {patient.gender})
                      </p>
                      <Badge className={getRiskColor(patient.riskLevel)}>{patient.riskLevel} risk</Badge>
                      <Badge className={getStatusColor(patient.status)}>{patient.status}</Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                      <span>ID: {patient.id}</span>
                      <span>Last Visit: {patient.lastVisit}</span>
                      <span>Total Scans: {patient.totalScans}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Recent: {patient.recentDiagnosis}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                    <Button variant="outline" size="sm">
                      History
                    </Button>
                    <Button size="sm">New Scan</Button>
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
