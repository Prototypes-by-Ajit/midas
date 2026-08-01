import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { IconBell, IconSettings } from "@tabler/icons-react"
import { NOTIFICATION_DELIVERY, NOTIFICATION_GROUPS } from "@/data/dashboard/notifications"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Manage your notification preferences and view recent alerts.",
}

/**
 * Server Component. Switch is a client primitive, so it forms its own boundary;
 * every prop passed to it here is serializable.
 */
export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your notification preferences and view recent alerts
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notification Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconSettings className="h-5 w-5 shrink-0" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Choose how you want to be notified about important events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {NOTIFICATION_GROUPS.map((group, groupIndex) => (
                <div
                  key={group.title}
                  className={
                    groupIndex === 0
                      ? "space-y-4"
                      : "space-y-4 pt-6 border-t border-border"
                  }
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {group.title}
                  </h3>

                  {group.toggles.map((toggle) => (
                    <div
                      key={toggle.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <Label htmlFor={toggle.id} className="text-foreground">
                          {toggle.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {toggle.description}
                        </p>
                      </div>
                      <Switch
                        id={toggle.id}
                        defaultChecked={toggle.defaultChecked}
                        className="shrink-0"
                      />
                    </div>
                  ))}
                </div>
              ))}

              {/* Delivery Methods */}
              <div className="space-y-4 pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  {NOTIFICATION_DELIVERY.title}
                </h3>

                <div className="space-y-3">
                  {NOTIFICATION_DELIVERY.toggles.map(({ id, label, icon: Icon, defaultChecked }) => (
                    <div key={id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon && (
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Label htmlFor={id} className="text-foreground">
                          {label}
                        </Label>
                      </div>
                      <Switch id={id} defaultChecked={defaultChecked} className="shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button className="bg-background text-white hover:bg-surface dark:bg-card dark:text-foreground">
                  Save Preferences
                </Button>
                <Button
                  variant="outline"
                  className="border-black text-foreground hover:bg-background hover:text-white dark:hover:bg-card dark:hover:text-foreground"
                >
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Notifications */}
        <Card className="bg-background border border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <IconBell className="h-5 w-5 shrink-0" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <IconBell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No notifications yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Your recent notifications will appear here once you start using MIDAS
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
