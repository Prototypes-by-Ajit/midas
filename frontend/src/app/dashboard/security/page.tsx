import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconAlertTriangle, IconDeviceDesktop, IconShield } from "@tabler/icons-react"
import { ACTIVE_SESSIONS, SECURITY_STATS } from "@/data/dashboard/security"

export const metadata: Metadata = {
  title: "Security & Privacy",
  description: "Manage your account security settings and privacy preferences.",
}

/** Server Component — this page has no state, effects or handlers. */
export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <IconShield className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
          Security &amp; Privacy
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your account security settings and privacy preferences
        </p>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {SECURITY_STATS.map(({ icon: Icon, title, iconClass, value, valueClass, badge, note }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</div>
              {badge && (
                <Badge variant="outline" className="mt-2 text-success border-success/25">
                  {badge}
                </Badge>
              )}
              {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconDeviceDesktop className="h-5 w-5 shrink-0" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage devices and sessions with access to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ACTIVE_SESSIONS.map((session) => (
              <div
                key={session.device}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <IconDeviceDesktop className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      <span className="truncate">{session.device}</span>
                      {session.current && (
                        <Badge variant="outline" className="text-success border-success/25">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {session.location} • {session.lastSeen}
                    </div>
                  </div>
                </div>
                {!session.current && (
                  <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0">
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button variant="destructive" className="w-full">
              <IconAlertTriangle className="h-4 w-4 mr-2 shrink-0" />
              Revoke All Other Sessions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
