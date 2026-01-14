"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  IconBrain,
  IconScanEye,
  IconFileAnalytics,
  IconHistory,
  IconCalendar,
  IconClock,
  IconShield,
  IconSparkles,
  IconRobot,
  IconActivity,
  IconChartDots3,
  IconMicroscope,
  IconStethoscope,
  IconBell,
  IconArrowRight,
  IconUsers
} from "@tabler/icons-react"
import { useAnalytics } from "@/contexts/analytics-context"
import { useUser } from "@/contexts/user-context"
import { useLoading } from "@/contexts/loading-context"
import { useState, useEffect } from "react"

export default function DashboardPage() {
  const { statistics } = useAnalytics()
  const { profile } = useUser()
  const { navigateWithLoading } = useLoading()
  const [userRole, setUserRole] = useState<string>('patient')
  const [usersCount, setUsersCount] = useState<number>(0)

  // Fetch user role from API
  useEffect(() => {
    console.log('Fetching user role...')
    fetch('/api/user/role')
      .then(res => res.json())
      .then(data => {
        console.log('User role data:', data)
        setUserRole(data.role || 'patient')
        // If admin, also fetch users count
        if (data.role === 'admin') {
          console.log('User is admin, fetching users count...')
          fetch('/api/admin/users')
            .then(res => res.json())
            .then(usersData => {
              console.log('Users data:', usersData)
              setUsersCount(usersData.total || 0)
            })
            .catch(err => console.error('Failed to fetch users count:', err))
        } else {
          console.log('User is not admin, role:', data.role)
        }
      })
      .catch(err => console.error('Failed to fetch user role:', err))
  }, [])

  const isAdmin = userRole === 'admin'

  console.log('Dashboard render - userRole:', userRole, 'isAdmin:', isAdmin, 'usersCount:', usersCount)

  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const handleNavigate = (path: string) => {
    navigateWithLoading(path)
  }
  
  const formatAccuracy = (accuracy: number) => {
    if (accuracy === 0) return '--'
    return `${(accuracy * 100).toFixed(1)}%`
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black">
      {/* Header Section */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <IconMicroscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-black dark:text-white">MIDAS Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Advanced dermatological analysis platform</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              System Online
            </Badge>
          </div>
          
          {/* User Welcome */}
          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src="/avatars/user.jpg" alt="MIDAS User" />
                  <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                    MU
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-black dark:text-white mb-1">
                    Welcome back, {profile?.name || 'MIDAS User'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Ready to advance dermatological care with AI-powered analysis
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <IconCalendar className="h-4 w-4" />
                      <span>{currentTime}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-2">
                    Professional Plan
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <IconShield className="h-4 w-4" />
                    <span>Verified Account</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Primary Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            onClick={() => handleNavigate('/dashboard/analysis')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <IconScanEye className="h-7 w-7 text-primary group-hover:text-white" />
              </div>
              <h3 className="font-semibold text-black dark:text-white mb-2">New Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Upload and analyze skin lesion images</p>
              <div className="flex items-center justify-center gap-1 text-xs text-primary group-hover:text-primary">
                <span>Get Started</span>
                <IconArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            onClick={() => handleNavigate('/dashboard/reports')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500 group-hover:scale-110 transition-all duration-300">
                <IconFileAnalytics className="h-7 w-7 text-blue-600 dark:text-blue-400 group-hover:text-white" />
              </div>
              <h3 className="font-semibold text-black dark:text-white mb-2">View Reports</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Access detailed analysis reports</p>
              <div className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <span>Browse Reports</span>
                <IconArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            onClick={() => handleNavigate('/dashboard/assistant')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-500 group-hover:scale-110 transition-all duration-300">
                <IconRobot className="h-7 w-7 text-purple-600 dark:text-purple-400 group-hover:text-white" />
              </div>
              <h3 className="font-semibold text-black dark:text-white mb-2">AI Assistant</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Chat with medical AI companion</p>
              <div className="flex items-center justify-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                <span>Ask Questions</span>
                <IconArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            onClick={() => handleNavigate('/dashboard/history')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500 group-hover:scale-110 transition-all duration-300">
                <IconHistory className="h-7 w-7 text-green-600 dark:text-green-400 group-hover:text-white" />
              </div>
              <h3 className="font-semibold text-black dark:text-white mb-2">Analysis History</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Review past analysis sessions</p>
              <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                <span>View History</span>
                <IconArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card
              className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              onClick={() => handleNavigate('/dashboard/users')}
            >
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500 group-hover:scale-110 transition-all duration-300">
                  <IconUsers className="h-7 w-7 text-orange-600 dark:text-orange-400 group-hover:text-white" />
                </div>
                <h3 className="font-semibold text-black dark:text-white mb-2">Users Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Manage user roles and permissions ({usersCount} users)</p>
                <div className="flex items-center justify-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <span>Manage Users</span>
                  <IconArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dashboard Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Activity Overview */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconActivity className="h-5 w-5" />
                Activity Overview
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Your analysis statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-black dark:text-white">{statistics.total_analyses}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Analyses</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-black dark:text-white">{formatAccuracy(statistics.avg_accuracy)}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Avg Accuracy</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">This Week</span>
                  <span className="text-sm font-semibold text-black dark:text-white">{statistics.recent_analyses} analyses</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconChartDots3 className="h-5 w-5" />
                Quick Insights
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                AI-powered recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <IconSparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-sm font-medium text-black dark:text-white">Ready to start</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Upload your first image for analysis</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <IconBrain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <div className="text-sm font-medium text-black dark:text-white">AI Assistant available</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Get expert dermatology insights</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconStethoscope className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Platform status monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-black dark:text-white">AI Models</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-black dark:text-white">Processing</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                  Normal
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-black dark:text-white">Database</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                  Connected
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Notifications */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Your latest MIDAS sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <IconClock className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-black dark:text-white mb-2">No recent activity</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Start your first analysis to see activity here
                </p>
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => handleNavigate('/dashboard/analysis')}
                >
                  <IconScanEye className="h-4 w-4 mr-2" />
                  Start Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications & Updates */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconBell className="h-5 w-5" />
                Notifications & Updates
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                System alerts and news
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-black dark:text-white">Welcome to MIDAS</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Your AI-powered dermatology platform is ready to use. Start by uploading your first image for analysis.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-black dark:text-white">AI Assistant Available</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Get instant answers to dermatology questions from our medical AI assistant.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links Footer */}
        <div className="flex items-center justify-center gap-6 py-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <IconMicroscope className="h-3 w-3" />
            <span>Advanced AI Analysis</span>
          </div>
          <div className="flex items-center gap-1">
            <IconStethoscope className="h-3 w-3" />
            <span>Medical Grade Platform</span>
          </div>
          <div className="flex items-center gap-1">
            <IconShield className="h-3 w-3" />
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </div>
  )
}
