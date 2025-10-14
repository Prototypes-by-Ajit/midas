"use client"

import React from "react"
import { LifeLine } from "@/components/ui/lifeline-loader"
import { cn } from "@/lib/utils"

interface LoadingPageProps {
  text?: string
  subtext?: string
  size?: "small" | "medium" | "large"
  color?: string
  textColor?: string
  className?: string
}

export function LoadingPage({
  text = "Loading...",
  subtext,
  size = "medium",
  color = "#525252", // neutral-600 for better visibility
  textColor,
  className
}: LoadingPageProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center",
      "bg-white/80 dark:bg-black/80 backdrop-blur-sm",
      className
    )}>
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <LifeLine 
          color={color}
          size={size}
          text={text}
          textColor={textColor}
        />
        {subtext && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs">
            {subtext}
          </p>
        )}
      </div>
    </div>
  )
}

export default LoadingPage