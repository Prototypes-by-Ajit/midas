"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavConversations } from "@/components/nav-conversations"
import type { NavItem } from "@/types/dashboard"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const ASSISTANT_URL = "/dashboard/assistant"

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                className={pathname === item.url ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
              >
                <Link href={item.url} className="flex items-center gap-2 w-full">
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {/* Only the assistant has a sub-tree, and only while you are on it.
                  Hardcoded rather than made a per-item slot: one call site. */}
              {item.url === ASSISTANT_URL && pathname.startsWith(ASSISTANT_URL) && (
                <NavConversations />
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
