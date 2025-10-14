import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { LoadingProvider } from "@/contexts/loading-context"
import { UserProvider } from "@/contexts/user-context"
import { AnalyticsProvider } from "@/contexts/analytics-context"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardContentWrapper } from "@/components/dashboard-content-wrapper"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <AuthGuard>
        <AnalyticsProvider>
          <LoadingProvider>
            <SidebarProvider
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 72)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              <AppSidebar variant="inset" />
              <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                  <div className="@container/main flex flex-1 flex-col gap-2">
                    <DashboardContentWrapper>
                      {children}
                    </DashboardContentWrapper>
                  </div>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </LoadingProvider>
        </AnalyticsProvider>
      </AuthGuard>
    </UserProvider>
  )
}
