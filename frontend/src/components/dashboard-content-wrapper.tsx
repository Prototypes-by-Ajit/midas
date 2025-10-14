"use client"

import React from "react"
import { useLoading } from "@/contexts/loading-context"
import ContentLoading from "@/components/content-loading"

interface DashboardContentWrapperProps {
  children: React.ReactNode
}

export function DashboardContentWrapper({ children }: DashboardContentWrapperProps) {
  const { isContentLoading, loadingText } = useLoading()

  return (
    <div className="relative flex flex-1 flex-col min-h-0">
      {children}
      {isContentLoading && (
        <ContentLoading 
          text={loadingText}
          size="medium"
          subtext="MIDAS Dashboard"
        />
      )}
    </div>
  )
}

export default DashboardContentWrapper