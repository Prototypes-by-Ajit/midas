"use client"

import { useUser, useAuth } from "@clerk/nextjs"
import { LifeLine } from "@/components/ui/lifeline-loader"

export function ClerkTest() {
  const { user, isSignedIn, isLoaded } = useUser()
  const { signOut } = useAuth()

  if (!isLoaded) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <LifeLine 
          color="#3b82f6" 
          size="medium" 
          text="Loading Clerk authentication..." 
          textColor="#6b7280"
        />
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <h3 className="font-semibold mb-2">Clerk Authentication Status</h3>
      <div className="space-y-2 text-sm">
        <p><strong>Is Loaded:</strong> {isLoaded ? "Yes" : "No"}</p>
        <p><strong>Is Signed In:</strong> {isSignedIn ? "Yes" : "No"}</p>
        {user && (
          <>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}</p>
            <p><strong>Full Name:</strong> {user.fullName}</p>
          </>
        )}
        {isSignedIn && (
          <button 
            onClick={() => signOut()} 
            className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>
    </div>
  )
}