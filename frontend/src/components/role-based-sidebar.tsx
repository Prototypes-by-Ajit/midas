"use client"

import * as React from "react"
import { IconBrain } from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { ShellDisclaimer } from "@/components/clinical/medical-disclaimer"
import { useUser } from "@/contexts/user-context"
import type { UserRole } from "@/contexts/role-context"
import {
  ADMIN_NAV,
  CLINICIAN_NAV,
  MAIN_NAV,
  SECONDARY_NAV,
} from "@/data/dashboard/navigation"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * `role` is resolved on the server in `app/dashboard/layout.tsx`, so the
 * clinician/admin links are present on first paint instead of popping in
 * after a client-side role fetch.
 */
export function PatientSidebar({
  role,
  ...props
}: { role: UserRole } & React.ComponentProps<typeof Sidebar>) {
  const { profile } = useUser()

  // Admin is the sole operator role (ml_engineer/sre collapsed into it,
  // 2026-08-31) and gets ONLY its own nav array, per quickstart.md's "no
  // gaps" sidebar spec — not MAIN_NAV plus ADMIN_NAV.
  const mainNavItems = React.useMemo(() => {
    if (role === "admin") return ADMIN_NAV
    if (role === "clinician") return [...MAIN_NAV, ...CLINICIAN_NAV]
    return MAIN_NAV
  }, [role])

  return (
    /* Icon rail, per the design shell (18rem -> 3rem) rather than offcanvas:
       the conversation tree lives in here now, and a sidebar that vanishes
       entirely takes the assistant's navigation with it. `NavMain` was already
       passing `tooltip` per item, which only renders in icon mode. */
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <IconBrain className="!size-5" />
                <span className="text-base font-semibold">MIDAS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavItems} />
        <NavSecondary items={SECONDARY_NAV} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="gap-2">
        <NavUser user={{
          name: profile?.name || "MIDAS User",
          email: profile?.email || "user@midas.com",
          avatar: profile?.avatar || "/avatars/user.jpg"
        }} />
        {/* Persistent but quiet. The header copy is hidden below md, so this is
            the disclaimer's home on mobile, where the rail is a sheet. */}
        <ShellDisclaimer className="pb-1 group-data-[collapsible=icon]:hidden" />
      </SidebarFooter>
    </Sidebar>
  )
}
