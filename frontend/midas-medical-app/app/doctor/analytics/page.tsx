"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Users, Activity, Clock, Target } from "lucide-react"
// import { AIChatbot } from "@/components/ai-chatbot"

export default function DoctorAnalytics() {
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
                <Link href="/doctor/patients" className="text-muted-foreground hover:text-foreground">
                  Patients
                </Link>
                <Link href="/doctor/reports" className="text-muted-foreground hover:text-foreground">
                  Reports
                </Link>
                <Link href="/doctor/analytics" className="text-primary font-medium">
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your diagnostic performance and patient outcomes</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">247</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-primary" />
                +12% from last month
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Reviewed</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-primary" />
                +8% from last month
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.3m</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-primary" />
                -15% from last month
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">96.7%</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-primary" />
                +0.3% from last month
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Diagnostic Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Performance</CardTitle>
              <CardDescription>Your accuracy by cancer type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { type: "Melanoma", accuracy: 94, cases: 45 },
                { type: "Basal Cell Carcinoma", accuracy: 97, cases: 78 },
                { type: "Squamous Cell Carcinoma", accuracy: 96, cases: 32 },
                { type: "Benign Nevus", accuracy: 98, cases: 156 },
                { type: "Actinic Keratosis", accuracy: 95, cases: 67 },
              ].map((item) => (
                <div key={item.type} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.type}</span>
                    <span className="text-muted-foreground">
                      {item.accuracy}% ({item.cases} cases)
                    </span>
                  </div>
                  <Progress value={item.accuracy} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest diagnostic reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    patient: "John Smith",
                    diagnosis: "Melanoma",
                    confidence: 87,
                    time: "2 hours ago",
                    status: "high-risk",
                  },
                  {
                    patient: "Mary Johnson",
                    diagnosis: "Benign Nevus",
                    confidence: 94,
                    time: "4 hours ago",
                    status: "low-risk",
                  },
                  {
                    patient: "Robert Brown",
                    diagnosis: "Basal Cell Carcinoma",
                    confidence: 91,
                    time: "6 hours ago",
                    status: "moderate-risk",
                  },
                  {
                    patient: "Sarah Davis",
                    diagnosis: "Actinic Keratosis",
                    confidence: 89,
                    time: "1 day ago",
                    status: "moderate-risk",
                  },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{activity.patient}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.diagnosis} • {activity.confidence}% confidence
                      </p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                    <Badge
                      className={
                        activity.status === "high-risk"
                          ? "bg-destructive text-destructive-foreground"
                          : activity.status === "moderate-risk"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-primary text-primary-foreground"
                      }
                    >
                      {activity.status.replace("-", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
            <CardDescription>Track your performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">247</div>
                <p className="text-sm text-muted-foreground">Patients This Month</p>
                <div className="flex items-center justify-center mt-1">
                  <TrendingUp className="h-4 w-4 text-primary mr-1" />
                  <span className="text-sm text-primary">+12%</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">96.7%</div>
                <p className="text-sm text-muted-foreground">Average Accuracy</p>
                <div className="flex items-center justify-center mt-1">
                  <TrendingUp className="h-4 w-4 text-primary mr-1" />
                  <span className="text-sm text-primary">+0.3%</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">2.3m</div>
                <p className="text-sm text-muted-foreground">Avg Review Time</p>
                <div className="flex items-center justify-center mt-1">
                  <TrendingDown className="h-4 w-4 text-primary mr-1" />
                  <span className="text-sm text-primary">-15%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
