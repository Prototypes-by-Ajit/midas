"use client"

import type React from "react"

import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "next-themes"
import { DemoBanner } from "@/components/demo-banner"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()

  return (
    <>
      {/* Added demo banner to show when in demo mode */}
      <Suspense fallback={<div>Loading...</div>}>
        <DemoBanner />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </Suspense>
    </>
  )
}
