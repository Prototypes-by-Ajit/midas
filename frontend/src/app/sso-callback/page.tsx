"use client"

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export const dynamic = "force-dynamic"

export default function SSOCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Authenticating You! MIDAS does that </p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
