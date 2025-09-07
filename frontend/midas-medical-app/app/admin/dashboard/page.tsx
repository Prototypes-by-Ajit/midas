"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

// Mock data for admin dashboard
const monthlyData = {
  totalScans: 1247,
  positiveCases: 89,
  avgDetectionTime: 3.2,
  accuracy: 94.3,
  systemUptime: 99.97,
  storageUsed: 2.4,
  storageTotal: 5.0,
  activeUsers: 187,
}

const departmentData = [
  {
    department: "Dermatology",
    doctors: 12,
    scans: 847,
    avgTime: 4.1,
    rating: 4.8,
    accuracy: 95.2,
  },
  {
    department: "Oncology",
    doctors: 8,
    scans: 289,
    avgTime: 6.3,
    rating: 4.7,
    accuracy: 93.8,
  },
  {
    department: "Primary Care",
    doctors: 15,
    scans: 111,
    avgTime: 3.8,
    rating: 4.6,
    accuracy: 92.1,
  },
]

const casesByTypeData = [
  { name: "Benign Nevus", value: 45, color: "#10b981" },
  { name: "Melanoma", value: 12, color: "#ef4444" },
  { name: "BCC", value: 18, color: "#f97316" },
  { name: "SCC", value: 8, color: "#eab308" },
  { name: "Actinic Keratosis", value: 10, color: "#8b5cf6" },
  { name: "Other", value: 7, color: "#6b7280" },
]

const dailyVolumeData = [
  { date: "Jan 1", scans: 45 },
  { date: "Jan 2", scans: 52 },
  { date: "Jan 3", scans: 48 },
  { date: "Jan 4", scans: 61 },
  { date: "Jan 5", scans: 55 },
  { date: "Jan 6", scans: 67 },
  { date: "Jan 7", scans: 43 },
]

const recentUsers = [
  {
    id: "U001",
    name: "Dr. Sarah Johnson",
    role: "doctor",
    department: "Dermatology",
    lastActive: "2024-01-15T14:30:00Z",
    status: "active",
  },
  {
    id: "U002",
    name: "John Smith",
    role: "patient",
    department: "-",
    lastActive: "2024-01-15T12:15:00Z",
    status: "active",
  },
  {
    id: "U003",
    name: "Dr. Michael Chen",
    role: "doctor",
    department: "Oncology",
    lastActive: "2024-01-15T10:45:00Z",
    status: "active",
  },
]

const systemAlerts = [
  {
    id: "A001",
    type: "warning",
    message: "Storage usage approaching 50% capacity",
    timestamp: "2024-01-15T14:30:00Z",
  },
  {
    id: "A002",
    type: "info",
    message: "Model accuracy improved to 94.3%",
    timestamp: "2024-01-15T12:00:00Z",
  },
  {
    id: "A003",
    type: "success",
    message: "System backup completed successfully",
    timestamp: "2024-01-15T06:00:00Z",
  },
]

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("30d")

  const getAlertColor = (type: string) => {
    switch (type) {
      case "error":
        return "bg-destructive text-destructive-foreground"
      case "warning":
        return "bg-orange-100 text-orange-800"
      case "success":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "doctor":
        return "bg-primary text-primary-foreground"
      case "admin":
        return "bg-secondary text-secondary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
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
              <span className="text-sm text-muted-foreground">Hospital Administration</span>
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/admin/dashboard" className="text-primary font-medium">
                  Dashboard
                </Link>
                <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
                  Users
                </Link>
                <Link href="/admin/analytics" className="text-muted-foreground hover:text-foreground">
                  Analytics
                </Link>
                <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
                  Settings
                </Link>
                <Link href="/admin/audit" className="text-muted-foreground hover:text-foreground">
                  Audit Logs
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                Export Report
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
          <h1 className="text-3xl font-bold text-foreground mb-2">General Hospital - Administrative Dashboard</h1>
          <p className="text-muted-foreground">System overview and management console</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{monthlyData.totalScans.toLocaleString()}</div>
              <p className="text-sm text-primary">+12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Positive Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{monthlyData.positiveCases}</div>
              <p className="text-sm text-muted-foreground">
                {((monthlyData.positiveCases / monthlyData.totalScans) * 100).toFixed(1)}% detection rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Detection Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{monthlyData.avgDetectionTime} min</div>
              <p className="text-sm text-primary">-0.3 min improvement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Model Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{monthlyData.accuracy}%</div>
              <p className="text-sm text-primary">+0.8% this month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
            <TabsTrigger value="users">User Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Cases by Type Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Cases by Type</CardTitle>
                  <CardDescription>Distribution of diagnosed cases this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={casesByTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {casesByTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Daily Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Scan Volume</CardTitle>
                  <CardDescription>Number of scans processed per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="scans" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* System Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>Recent system notifications and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                      <Badge className={getAlertColor(alert.type)}>{alert.type}</Badge>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Performance metrics by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departmentData.map((dept) => (
                    <div key={dept.department} className="p-4 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-foreground">{dept.department}</h3>
                        <Badge variant="outline">{dept.doctors} doctors</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Scans</p>
                          <p className="font-medium">{dept.scans}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Time</p>
                          <p className="font-medium">{dept.avgTime} min</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rating</p>
                          <p className="font-medium">{dept.rating}/5</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Accuracy</p>
                          <p className="font-medium text-primary">{dept.accuracy}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Department Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Department Scan Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="scans" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">System Uptime</span>
                    <span className="font-medium text-primary">{monthlyData.systemUptime}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Users</span>
                    <span className="font-medium">{monthlyData.activeUsers}</span>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Storage Used</span>
                      <span className="font-medium">
                        {monthlyData.storageUsed}TB / {monthlyData.storageTotal}TB
                      </span>
                    </div>
                    <Progress value={(monthlyData.storageUsed / monthlyData.storageTotal) * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">API Response Time</span>
                    <span className="font-medium">245ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">ML Inference Time</span>
                    <span className="font-medium">2.1s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Error Rate</span>
                    <span className="font-medium text-primary">0.02%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Throughput</span>
                    <span className="font-medium">1,247 scans/day</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Current system settings and configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Model Settings</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Model Version</span>
                        <span>MIDAS-v2.1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confidence Threshold</span>
                        <span>85%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto-Review Enabled</span>
                        <Badge variant="outline">Yes</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Security Settings</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MFA Required</span>
                        <Badge variant="outline">Enabled</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Session Timeout</span>
                        <span>15 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Audit Logging</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent User Activity</CardTitle>
                <CardDescription>Latest user logins and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-4 p-3 rounded-lg border border-border">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium text-sm">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium text-foreground">{user.name}</p>
                          <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.department !== "-" ? user.department : "Patient"} • Last active:{" "}
                          {new Date(user.lastActive).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Statistics */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">187</div>
                  <p className="text-sm text-primary">+5 this week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Doctors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">35</div>
                  <p className="text-sm text-muted-foreground">Across 3 departments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Patient Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">150</div>
                  <p className="text-sm text-primary">+12 this month</p>
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
              <Button>Generate Monthly Report</Button>
              <Button variant="outline" className="bg-transparent">
                Export User Data
              </Button>
              <Button variant="outline" className="bg-transparent">
                System Backup
              </Button>
              <Button variant="outline" className="bg-transparent">
                View Audit Logs
              </Button>
              <Button variant="outline" className="bg-transparent">
                System Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
