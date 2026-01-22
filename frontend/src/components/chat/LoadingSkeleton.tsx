"use client"

import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  type?: "message" | "conversation" | "typing"
  count?: number
  className?: string
}

export function LoadingSkeleton({ type = "message", count = 1, className }: LoadingSkeletonProps) {
  if (type === "typing") {
    return (
      <div className={cn("flex items-center gap-2 px-4 py-3", className)}>
        <div className="flex items-center gap-1">
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
        </div>
        <span className="text-xs text-muted-foreground">Thinking...</span>
      </div>
    )
  }

  if (type === "conversation") {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border/60 bg-muted/40 p-3"
          >
            <div className="mb-2 h-4 w-3/4 rounded bg-muted-foreground/20" />
            <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    )
  }

  // Default: message skeleton
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-muted-foreground/20 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 rounded bg-muted-foreground/20" />
            <div className="h-3 w-full rounded bg-muted-foreground/10" />
            <div className="h-3 w-5/6 rounded bg-muted-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  )
}
