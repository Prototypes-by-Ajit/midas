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
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useUser } from "@/contexts/user-context"
import { useLoading } from "@/contexts/loading-context"
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
        <NavMain items={navigationConfig.main} />
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
