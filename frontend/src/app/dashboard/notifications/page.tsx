export const dynamic = "force-dynamic"
export const revalidate = 0

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  IconBell, 
  IconMail,
  IconPhone,
  IconDeviceDesktop,
  IconSettings
} from "@tabler/icons-react"

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">Notifications</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your notification preferences and view recent alerts
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notification Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconSettings className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Choose how you want to be notified about important events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Analysis Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-black dark:text-white">Analysis & Reports</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="analysis-complete" className="text-black dark:text-white">Analysis Complete</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when your AI analysis is completed
                    </p>
                  </div>
                  <Switch id="analysis-complete" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="high-risk" className="text-black dark:text-white">High-Risk Detection</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Immediate alerts for high-risk lesions detected
                    </p>
                  </div>
                  <Switch id="high-risk" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="report-ready" className="text-black dark:text-white">Report Generation</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Notify when detailed reports are generated
                    </p>
                  </div>
                  <Switch id="report-ready" defaultChecked />
                </div>
              </div>

              {/* System Notifications */}
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-black dark:text-white">System & Account</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="system-updates" className="text-black dark:text-white">System Updates</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Important system updates and maintenance alerts
                    </p>
                  </div>
                  <Switch id="system-updates" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="security-alerts" className="text-black dark:text-white">Security Alerts</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Login alerts and security-related notifications
                    </p>
                  </div>
                  <Switch id="security-alerts" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="usage-summary" className="text-black dark:text-white">Usage Summary</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Weekly summary of your MIDAS usage and statistics
                    </p>
                  </div>
                  <Switch id="usage-summary" />
                </div>
              </div>

              {/* Notification Methods */}
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-black dark:text-white">Delivery Methods</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconDeviceDesktop className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <Label htmlFor="in-app" className="text-black dark:text-white">In-App Notifications</Label>
                    </div>
                    <Switch id="in-app" defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconMail className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <Label htmlFor="email" className="text-black dark:text-white">Email Notifications</Label>
                    </div>
                    <Switch id="email" defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconPhone className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <Label htmlFor="sms" className="text-black dark:text-white">SMS Notifications</Label>
                    </div>
                    <Switch id="sms" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                  Save Preferences
                </Button>
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black">
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Notifications */}
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-black dark:text-white flex items-center gap-2">
              <IconBell className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <IconBell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-black dark:text-white mb-2">No notifications yet</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your recent notifications will appear here once you start using MIDAS
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}