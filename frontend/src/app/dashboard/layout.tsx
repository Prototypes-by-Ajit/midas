"use client"

import { PatientSidebar } from "@/components/role-based-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LifeLine } from "@/components/ui/lifeline-loader"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Redirect to login if not authenticated
      router.push('/login?redirect_url=' + encodeURIComponent(window.location.pathname))
    }
  }, [isSignedIn, isLoaded, router])
  
  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <LifeLine 
          color="#3b82f6" 
          size="medium" 
          text="Verifying authentication..." 
          textColor="#6b7280"
        />
      </div>
    )
  }
  
  // Don't render dashboard if not authenticated
  if (!isSignedIn) {
    return null
  }
  
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <PatientSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
