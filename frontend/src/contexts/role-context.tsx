"use client"

import { createContext, useContext } from "react"

export type UserRole = "patient" | "clinician" | "admin"

/**
 * The role is resolved once on the server in `app/dashboard/layout.tsx` and
 * handed down through this context, because App Router cannot prop-drill into
 * `page.tsx`. It is fixed for the request — no state, no effect, no fetch.
 *
 * Display gating only. Every role-restricted API route re-checks with
 * `auth()` + `clerkClient` on the server.
 */
const RoleContext = createContext<UserRole>("patient")

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
