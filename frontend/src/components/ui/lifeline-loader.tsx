"use client"

import React from "react"
import { LifeLine as ReactLifeLine } from "react-loading-indicators"
import { cn } from "@/lib/utils"

interface LifeLineProps {
  color?: string
  size?: "small" | "medium" | "large"
  text?: string
  textColor?: string
  className?: string
}

export function LifeLine({
  color = "#525252", // neutral-600 for better visibility in light/dark modes
  size = "medium",
  text = "",
  textColor = "",
  className
}: LifeLineProps) {
  const textSizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg"
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      {/* React Loading Indicators LifeLine */}
      <ReactLifeLine 
        color={color}
        size={size as "small" | "medium" | "large"}
        text={""}
        textColor={textColor || color}
      />
      
      {/* Optional text */}
      {text && (
        <p 
          className={cn(
            "font-medium animate-pulse text-center",
            textSizeClasses[size]
          )}
          style={{ color: textColor || color }}
        >
          {text}
        </p>
      )}
    </div>
  )
}

export default LifeLine