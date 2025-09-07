"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

// Mock user data
const mockUsers = [
  {
    id: "U001",
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@hospital.com",
    role: "doctor",
    department: "Dermatology",
    status: "active",
    lastLogin: "2024-01-15T14:30:00Z",
    createdAt: "2023-06-15",
    scansReviewed: 247,
    licenseNumber: "MD123456",
  },
  {
    id: "U002",
    name: "John Smith",
    email: "john.smith@email.com",
    role: "patient",
    department: "-",
    status: "active",
    lastLogin: "2024-01-15T12:15:00Z",
    createdAt: "2024-01-01",
    scansReviewed: 0,
    licenseNumber: "-",
  },
  {
    id: "U003",
    name: "Dr. Michael Chen",
    email: "michael.chen@hospital.com",
    role: "doctor",
    department: "Oncology",
    status: "active",
    lastLogin: "2024-01-15T10:45:00Z",
    createdAt: "2023-08-20",
    scansReviewed: 189,
    licenseNumber: "MD789012",
  },
  {
    id: "U004",
    name: "Admin User",
    email: "admin@hospital.com",
    role: "admin",
    department: "IT",
    status: "active",
    lastLogin: "2024-01-15T16:00:00Z",
    createdAt: "2023-01-01",
    scansReviewed: 0,
    licenseNumber: "-",
  },
  {
    id: "U005",
    name: "Dr. Emily Davis",
    email: "emily.davis@hospital.com",
    role: "doctor",
    department: "Dermatology",
    status: "suspended",
    lastLogin: "2024-01-10T09:30:00Z",
    createdAt: "2023-09-10",
    scansReviewed: 156,
    licenseNumber: "MD345678",
  },
]

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedUser, setSelectedUser] = useState<(typeof mockUsers)[0] | null>(null)

  const getRoleColor = (role: string) => {
    switch (role) {
      case "doctor":
        return "bg-primary text-primary-foreground"
      case "admin":
        return "bg-secondary text-secondary-foreground"
      case "patient":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground"
      case "suspended":
        return "bg-destructive text-destructive-foreground"
      case "pending":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
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
                <Link href="/admin/users" className="text-primary font-medium">
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
              <Button>Add New User</Button>
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
            <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage system users, roles, and permissions</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" className="bg-transparent">
              Export Users
            </Button>
            <Button variant="outline" className="bg-transparent">
              Bulk Actions
            </Button>
          </div>
        </div>

        {/* User Statistics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{mockUsers.length}</div>
              <p className="text-sm text-primary">+5 this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Doctors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {mockUsers.filter((u) => u.role === "doctor" && u.status === "active").length}
              </div>
              <p className="text-sm text-muted-foreground">Verified professionals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Patient Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {mockUsers.filter((u) => u.role === "patient").length}
              </div>
              <p className="text-sm text-primary">+12 this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {mockUsers.filter((u) => u.status === "pending").length}
              </div>
              <p className="text-sm text-muted-foreground">Require review</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="doctor">Doctors</SelectItem>
                  <SelectItem value="patient">Patients</SelectItem>
                  <SelectItem value="admin">Administrators</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>System users and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                      <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                      <span>{user.email}</span>
                      <span>ID: {user.id}</span>
                      {user.department !== "-" && <span>{user.department}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last login: {new Date(user.lastLogin).toLocaleString()}
                      {user.role === "doctor" && ` • ${user.scansReviewed} scans reviewed`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>User Details</DialogTitle>
                          <DialogDescription>Detailed information for {selectedUser?.name}</DialogDescription>
                        </DialogHeader>
                        {selectedUser && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <Label className="text-muted-foreground">User ID</Label>
                                <p className="font-medium">{selectedUser.id}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Role</Label>
                                <p className="font-medium">{selectedUser.role}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Department</Label>
                                <p className="font-medium">{selectedUser.department}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Status</Label>
                                <p className="font-medium">{selectedUser.status}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Created</Label>
                                <p className="font-medium">{selectedUser.createdAt}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Last Login</Label>
                                <p className="font-medium">{new Date(selectedUser.lastLogin).toLocaleDateString()}</p>
                              </div>
                              {selectedUser.licenseNumber !== "-" && (
                                <div className="col-span-2">
                                  <Label className="text-muted-foreground">License Number</Label>
                                  <p className="font-medium">{selectedUser.licenseNumber}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button size="sm" className="flex-1">
                                Edit User
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                                Reset Password
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button variant={user.status === "active" ? "destructive" : "default"} size="sm">
                      {user.status === "active" ? "Suspend" : "Activate"}
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
