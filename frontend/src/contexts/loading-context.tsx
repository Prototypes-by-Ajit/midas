"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import LoadingPage from "@/components/loading-page"

interface LoadingContextType {
  isLoading: boolean
  isContentLoading: boolean
  loadingText: string
  navigateWithLoading: (path: string, text?: string, delay?: number) => void
  navigateWithoutLoading: (path: string) => void
  setLoadingState: (loading: boolean, text?: string) => void
  setContentLoadingState: (loading: boolean, text?: string) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
}

interface LoadingProviderProps {
  children: React.ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [loadingText, setLoadingText] = useState("Loading...")
  const router = useRouter()
  const pathname = usePathname()

  const setLoadingState = useCallback((loading: boolean, text?: string) => {
    setIsLoading(loading)
    if (text) setLoadingText(text)
  }, [])

  const setContentLoadingState = useCallback((loading: boolean, text?: string) => {
    setIsContentLoading(loading)
    if (text) setLoadingText(text)
  }, [])

  const navigateWithLoading = useCallback(
    (path: string, text?: string, delay: number = 800) => {
      if (pathname === path) return
      
      // Check if this is a home-login transition that should not show loader
      const isHomeLoginTransition = shouldSkipLoader(pathname, path)
      
      if (isHomeLoginTransition) {
        router.push(path)
        return
      }
      
      const loadingMessage = text || getLoadingTextForPath(path)
      setLoadingText(loadingMessage)
      
      // Use content loading for dashboard-to-dashboard navigation
      const isDashboardToNextDashboard = pathname.startsWith('/dashboard') && path.startsWith('/dashboard')
      
      if (isDashboardToNextDashboard) {
        setIsContentLoading(true)
        // Shorter delay for content loading
        setTimeout(() => {
          router.push(path)
          setTimeout(() => {
            setIsContentLoading(false)
          }, 200)
        }, 300)
      } else {
        setIsLoading(true)
        // Simulate loading delay for smooth UX
        setTimeout(() => {
          router.push(path)
          setTimeout(() => {
            setIsLoading(false)
          }, 300)
        }, delay)
      }
    },
    [router, pathname]
  )
  
  const navigateWithoutLoading = useCallback(
    (path: string) => {
      if (pathname === path) return
      router.push(path)
    },
    [router, pathname]
  )

  const shouldSkipLoader = (currentPath: string, targetPath: string): boolean => {
    // Define home pages
    const homePages = ['/', '/learn-more', '/aboutus', '/contact', '/terms', '/privacy', '/docs']
    const isFromHome = homePages.includes(currentPath)
    const isToHome = homePages.includes(targetPath)
    const isFromLogin = currentPath === '/login'
    const isToLogin = targetPath === '/login'
    
    // Skip loader for:
    // 1. Home to Login transitions
    // 2. Login to Home transitions
    // 3. Home to Home transitions
    return (isFromHome && isToLogin) || (isFromLogin && isToHome) || (isFromHome && isToHome)
  }

  const getLoadingTextForPath = (path: string): string => {
    const pathMap: Record<string, string> = {
      '/dashboard': 'Loading Dashboard...',
      '/dashboard/analysis': 'Preparing Analysis Tools...',
      '/dashboard/reports': 'Loading Reports...',
      '/dashboard/history': 'Accessing History...',
      '/dashboard/settings': 'Loading Settings...',
      '/dashboard/notifications': 'Loading Notifications...',
      '/dashboard/assistant': 'Starting AI Assistant...',
      '/login': 'Redirecting to Sign In...',
      '/': 'Returning Home...'
    }
    
    return pathMap[path] || 'Loading...'
  }

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        isContentLoading,
        loadingText,
        navigateWithLoading,
        navigateWithoutLoading,
        setLoadingState,
        setContentLoadingState,
      }}
    >
      {children}
      {isLoading && (
        <LoadingPage 
          text={loadingText}
          color="#525252"
          size="large"
          subtext="MIDAS - Advanced AI Healthcare Platform"
        />
      )}
    </LoadingContext.Provider>
  )
}