"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { 
  IconShield, 
  IconKey, 
  IconDeviceDesktop,
  IconEye,
  IconFingerprint,
  IconAlertTriangle
} from "@tabler/icons-react"

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <IconShield className="h-8 w-8" />
          Security & Privacy
        </h1>
        <p className="text-muted-foreground">
          Manage your account security settings and privacy preferences
        </p>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            <IconShield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Secure</div>
            <Badge variant="outline" className="mt-2 text-green-600 border-green-600">
              All checks passed
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Two-Factor Auth</CardTitle>
            <IconFingerprint className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Enabled</div>
            <p className="text-xs text-muted-foreground mt-1">
              SMS & App based
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <IconDeviceDesktop className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground mt-1">
              Devices logged in
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconKey className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>
              Manage your login security and authentication methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Two-Factor Authentication</div>
                  <div className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Biometric Login</div>
                  <div className="text-sm text-muted-foreground">
                    Use fingerprint or face recognition
                  </div>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Login Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Get notified of new device logins
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button variant="outline" className="w-full">
                <IconKey className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              <Button variant="outline" className="w-full">
                <IconFingerprint className="h-4 w-4 mr-2" />
                Manage 2FA Methods
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconEye className="h-5 w-5" />
              Privacy Controls
            </CardTitle>
            <CardDescription>
              Control your data privacy and sharing preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Data Analytics</div>
                  <div className="text-sm text-muted-foreground">
                    Help improve MIDAS with usage analytics
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Medical Data Sharing</div>
                  <div className="text-sm text-muted-foreground">
                    Anonymous data for research purposes
                  </div>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Marketing Communications</div>
                  <div className="text-sm text-muted-foreground">
                    Receive product updates and tips
                  </div>
                </div>
                <Switch />
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button variant="outline" className="w-full">
                <IconEye className="h-4 w-4 mr-2" />
                View Privacy Policy
              </Button>
              <Button variant="outline" className="w-full">
                Export My Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconDeviceDesktop className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage devices and sessions with access to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { device: "MacBook Pro", location: "New York, US", current: true, lastSeen: "Active now" },
              { device: "iPhone 15", location: "New York, US", current: false, lastSeen: "2 hours ago" },
              { device: "Chrome Browser", location: "California, US", current: false, lastSeen: "1 day ago" }
            ].map((session, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <IconDeviceDesktop className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {session.device}
                      {session.current && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.location} • {session.lastSeen}
                    </div>
                  </div>
                </div>
                {!session.current && (
                  <Button variant="outline" size="sm">
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <Button variant="destructive" className="w-full">
              <IconAlertTriangle className="h-4 w-4 mr-2" />
              Revoke All Other Sessions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}