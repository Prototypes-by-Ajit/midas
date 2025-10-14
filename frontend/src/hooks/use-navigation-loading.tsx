"use client"

import { useLoading } from "@/contexts/loading-context"

export function useNavigationLoading() {
  const { navigateWithLoading, navigateWithoutLoading, ...rest } = useLoading()
  
  return {
    navigateWithLoading,
    navigateWithoutLoading,
    ...rest
  }
}

export default useNavigationLoading
