"use client"

import { UserProvider } from "@/contexts/user-context"
import { AnalyticsProvider } from "@/contexts/analytics-context"
import { LoadingProvider } from "@/contexts/loading-context"
import { ThemeProvider } from "next-themes"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <LoadingProvider>
        <UserProvider>
          <AnalyticsProvider>
            {children}
          </AnalyticsProvider>
        </UserProvider>
      </LoadingProvider>
    </ThemeProvider>
  )
}
