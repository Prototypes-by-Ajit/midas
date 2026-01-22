"use client"

import { useState } from "react"
import { UserProvider } from "@/contexts/user-context"
import { AnalyticsProvider } from "@/contexts/analytics-context"
import { LoadingProvider } from "@/contexts/loading-context"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <LoadingProvider>
          <UserProvider>
            <AnalyticsProvider>
              {children}
            </AnalyticsProvider>
          </UserProvider>
        </LoadingProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
