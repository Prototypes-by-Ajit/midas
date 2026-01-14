"use client"

import * as React from "react"
import {
  IconBrain,
  IconRobot,
  IconDashboard,
  IconFileAnalytics,
  IconHistory,
  IconScanEye,
  IconHelp,
  IconUsers,
  IconFolderOpen,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useUser } from "@/contexts/user-context"
import { useLoading } from "@/contexts/loading-context"
import { useUser as useClerkUser } from "@clerk/nextjs"
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

// Navigation items for patient dashboard
const navigationConfig = {
  main: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "AI Analysis",
      url: "/dashboard/analysis",
      icon: IconScanEye,
    },
    {
      title: "AI Assistant",
      url: "/dashboard/assistant",
      icon: IconRobot,
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: IconFileAnalytics,
    },
    {
      title: "History",
      url: "/dashboard/history",
      icon: IconHistory,
    },
  ],
  secondary: [
    {
      title: "Help",
      url: "/dashboard/help",
      icon: IconHelp,
    },
  ],
}

export function PatientSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { profile } = useUser()
  const { navigateWithLoading } = useLoading()
  const { user: clerkUser } = useClerkUser()
  const [userRole, setUserRole] = React.useState<string>('patient')

  // Fetch user role from API (checks privateMetadata on backend)
  React.useEffect(() => {
    if (clerkUser) {
      fetch('/api/user/role')
        .then(res => res.json())
        .then(data => setUserRole(data.role || 'patient'))
        .catch(err => console.error('Failed to fetch user role:', err))
    }
  }, [clerkUser])

  const isAdmin = userRole === 'admin'
  const isClinician = userRole === 'clinician'

  // Add role-specific navigation items
  const mainNavItems = React.useMemo(() => {
    const items = [...navigationConfig.main]

    // Add Documents link for clinicians only
    if (isClinician) {
      items.push({
        title: "Documents",
        url: "/dashboard/documents",
        icon: IconFolderOpen,
      })
    }

    // Add Users link for admins only
    if (isAdmin) {
      items.push({
        title: "Users",
        url: "/dashboard/users",
        icon: IconUsers,
      })
    }

    return items
  }, [isAdmin, isClinician])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link
                href="/dashboard"
                onClick={(e) => {
                  e.preventDefault()
                  navigateWithLoading('/dashboard')
                }}
              >
                <IconBrain className="!size-5" />
                <span className="text-base font-semibold">MIDAS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavItems} />
        <NavSecondary items={navigationConfig.secondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{
          name: profile?.name || "MIDAS User",
          email: profile?.email || "user@midas.com",
          avatar: profile?.avatar || "/avatars/user.jpg"
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}
