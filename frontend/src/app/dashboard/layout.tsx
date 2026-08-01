import { redirect } from "next/navigation"

import { PatientSidebar } from "@/components/role-based-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { RoleProvider } from "@/contexts/role-context"
import { getSessionUser } from "@/services/auth.server"

/**
 * Server Component. `middleware.ts` already gates `/dashboard(.*)`, so the
 * `redirect` below is defence in depth rather than the primary check — but
 * resolving auth here (instead of with `useUser()` on the client) means the
 * page HTML is not held back behind a Clerk-JS round trip.
 *
 * `getSessionUser` is React-`cache()`d, so this lookup is shared with any page
 * in the segment that needs the role server-side — one Clerk call per request.
 * The role then reaches client pages through `RoleProvider`, replacing the five
 * `fetch('/api/user/role')` effects that used to run after hydration.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const { role } = session

  return (
    <RoleProvider role={role}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <PatientSidebar variant="inset" role={role} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
