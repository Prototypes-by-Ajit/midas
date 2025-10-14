"use client"

import React from "react"
import { LifeLine } from "@/components/ui/lifeline-loader"
import { cn } from "@/lib/utils"

interface ContentLoadingProps {
  text?: string
  subtext?: string
  size?: "small" | "medium" | "large"
  color?: string
  textColor?: string
  className?: string
}

export function ContentLoading({
  text = "Loading...",
  subtext,
  size = "medium",
  color = "#525252",
  textColor,
  className
}: ContentLoadingProps) {
  return (
    <div className={cn(
      "absolute inset-0 z-40 flex items-center justify-center",
      "bg-white/80 dark:bg-black/80 backdrop-blur-sm",
      "rounded-lg", // Add rounded corners to match content area
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

export default ContentLoading