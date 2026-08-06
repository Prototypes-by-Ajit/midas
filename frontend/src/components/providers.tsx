"use client"

import { useState } from "react"
import { UserProvider } from "@/contexts/user-context"
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
        {/*
          AnalyticsProvider was removed here: it fetched /api/analysis/history on
          mount from this global position, so the request fired on marketing
          pages too. The dashboard pages that needed it now read the same data
          server-side via services/analysis.server.ts.
        */}
        <LoadingProvider>
          <UserProvider>{children}</UserProvider>
        </LoadingProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
