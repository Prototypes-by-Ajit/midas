"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

// Mock audit log data
const mockAuditLogs = [
  {
    id: "AL001",
    timestamp: "2024-01-15T14:30:00Z",
    userId: "U001",
    userName: "Dr. Sarah Johnson",
    action: "ANALYSIS_REVIEWED",
    resourceType: "analysis",
    resourceId: "AN2024005",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    details: "Reviewed melanoma analysis for patient P001234",
    riskLevel: "medium",
  },
  {
    id: "AL002",
    timestamp: "2024-01-15T14:25:00Z",
    userId: "P001234",
    userName: "John Smith",
    action: "IMAGE_UPLOADED",
    resourceType: "image",
    resourceId: "IMG2024001",
    ipAddress: "10.0.0.50",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    details: "Uploaded skin lesion image for analysis",
    riskLevel: "low",
  },
  {
    id: "AL003",
    timestamp: "2024-01-15T14:20:00Z",
    userId: "U001",
    userName: "Dr. Sarah Johnson",
    action: "USER_LOGIN",
    resourceType: "session",
    resourceId: "SES2024001",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    details: "Successful login with MFA",
    riskLevel: "low",
  },
  {
    id: "AL004",
    timestamp: "2024-01-15T14:15:00Z",
    userId: "SYSTEM",
    userName: "System",
    action: "DATA_EXPORT",
    resourceType: "report",
    resourceId: "RPT2024001",
    ipAddress: "127.0.0.1",
    userAgent: "MIDAS-System/1.0",
    details: "Monthly compliance report generated",
    riskLevel: "high",
  },
  {
    id: "AL005",
    timestamp: "2024-01-15T14:10:00Z",
    userId: "U002",
    userName: "Admin User",
    action: "USER_CREATED",
    resourceType: "user",
    resourceId: "U006",
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    details: "Created new doctor account for Dr. Lisa Wilson",
    riskLevel: "medium",
  },
]

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-destructive text-destructive-foreground"
      case "medium":
        return "bg-orange-100 text-orange-800"
      case "low":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getActionColor = (action: string) => {
    const criticalActions = ["DATA_EXPORT", "USER_DELETED", "SYSTEM_CONFIG_CHANGED"]
    const warningActions = ["USER_CREATED", "ANALYSIS_REVIEWED", "PASSWORD_RESET"]

    if (criticalActions.includes(action)) {
      return "text-destructive"
    } else if (warningActions.includes(action)) {
      return "text-orange-600"
    }
    return "text-foreground"
  }

  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAction = actionFilter === "all" || log.action === actionFilter
    const matchesRisk = riskFilter === "all" || log.riskLevel === riskFilter
    const matchesUser = userFilter === "all" || log.userId === userFilter
    return matchesSearch && matchesAction && matchesRisk && matchesUser
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
              <span className="text-sm text-muted-foreground">Hospital Administration</span>
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
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
                <Link href="/admin/audit" className="text-primary font-medium">
                  Audit Logs
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" className="bg-transparent">
                Export Logs
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Audit Logs</h1>
            <p className="text-muted-foreground">Complete audit trail of system activities for compliance</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge className="bg-primary text-primary-foreground">HIPAA Compliant</Badge>
            <Button variant="outline" className="bg-transparent">
              Generate Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{mockAuditLogs.length}</div>
              <p className="text-sm text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {mockAuditLogs.filter((log) => log.riskLevel === "high").length}
              </div>
              <p className="text-sm text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {new Set(mockAuditLogs.map((log) => log.userId)).size}
              </div>
              <p className="text-sm text-muted-foreground">Active today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Data Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {mockAuditLogs.filter((log) => log.resourceType === "analysis").length}
              </div>
              <p className="text-sm text-muted-foreground">Patient data accessed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Audit Logs</CardTitle>
            <CardDescription>Search and filter audit events for compliance reporting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="USER_LOGIN">User Login</SelectItem>
                  <SelectItem value="ANALYSIS_REVIEWED">Analysis Reviewed</SelectItem>
                  <SelectItem value="IMAGE_UPLOADED">Image Uploaded</SelectItem>
                  <SelectItem value="DATA_EXPORT">Data Export</SelectItem>
                  <SelectItem value="USER_CREATED">User Created</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Events ({filteredLogs.length})</CardTitle>
            <CardDescription>Chronological record of all system activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <p className={`text-sm font-medium ${getActionColor(log.action)}`}>{log.action}</p>
                      <Badge className={getRiskColor(log.riskLevel)}>{log.riskLevel}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">User: {log.userName}</p>
                        <p className="text-muted-foreground">Resource: {log.resourceType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">IP: {log.ipAddress}</p>
                        <p className="text-muted-foreground">ID: {log.resourceId}</p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground mt-2">{log.details}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{log.userAgent}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
