"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DemoBanner() {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const demoMode = localStorage.getItem("demo-mode")
    setIsDemoMode(demoMode === "true")
  }, [])

  const exitDemoMode = () => {
    localStorage.removeItem("demo-user")
    localStorage.removeItem("demo-mode")
    window.location.href = "/login"
  }

  if (!isDemoMode || !isVisible) return null

  return (
    <div className="bg-accent text-accent-foreground px-4 py-2 text-sm border-b border-border">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <span className="font-medium">🚀 Demo Mode Active</span>
          <span className="opacity-90">You're exploring MIDAS with sample data</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exitDemoMode}
            className="text-accent-foreground hover:bg-accent-foreground/20 h-6 px-2"
          >
            Exit Demo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="text-accent-foreground hover:bg-accent-foreground/20 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
