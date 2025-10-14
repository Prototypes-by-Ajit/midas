"use client"

import { type Icon } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLoading } from "@/contexts/loading-context"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  const { navigateWithLoading } = useLoading()

  const handleNavClick = (url: string, event: React.MouseEvent) => {
    event.preventDefault()
    navigateWithLoading(url)
  }

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
                <Link 
                  href={item.url}
                  onClick={(e) => handleNavClick(item.url, e)}
                  className="flex items-center gap-2 w-full"
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
