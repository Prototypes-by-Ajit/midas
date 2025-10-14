"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useUser as useClerkUser, useAuth } from '@clerk/nextjs'
import type { User } from "@supabase/supabase-js" // Keep for backward compatibility

interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
  created_at: string
  firstName?: string
  lastName?: string
  verified?: boolean
}

interface UserContextType {
  user: User | null // Keep for backward compatibility
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  isSignedIn: boolean
  clerkUser?: unknown // Add Clerk user access if needed
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

interface UserProviderProps {
  children: React.ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: clerkUser, isLoaded, isSignedIn } = useClerkUser()
  const { signOut: clerkSignOut } = useAuth()
  const [user, setUser] = useState<User | null>(null) // Legacy compatibility
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && clerkUser) {
        // Create user profile from Clerk user
        const userProfile: UserProfile = {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          name: clerkUser.fullName || 
                `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
                clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          avatar: clerkUser.imageUrl,
          created_at: clerkUser.createdAt?.toISOString() || new Date().toISOString(),
          verified: clerkUser.emailAddresses[0]?.verification?.status === 'verified'
        }
        setProfile(userProfile)
        
        // Create legacy user object for backward compatibility
        const legacyUser = {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          created_at: clerkUser.createdAt?.toISOString() || new Date().toISOString(),
          user_metadata: {
            username: clerkUser.firstName || '',
            avatar_url: clerkUser.imageUrl,
            full_name: clerkUser.fullName
          },
          app_metadata: {},
          aud: 'authenticated'
        } as User
        setUser(legacyUser)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, clerkUser])

  const signOut = async () => {
    try {
      await clerkSignOut()
      setUser(null)
      setProfile(null)
      // Redirect to home page after signout
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        isSignedIn: !!profile,
        clerkUser,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}