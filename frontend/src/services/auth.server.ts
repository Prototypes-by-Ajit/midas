import "server-only"

import { cache } from "react"
import { auth, clerkClient } from "@clerk/nextjs/server"

import type { UserRole } from "@/contexts/role-context"

export interface SessionUser {
  userId: string
  role: UserRole
  /** Preferred display name for greetings. Falls back to the email local part. */
  firstName: string
}

/**
 * The session's identity and role, resolved once per request.
 *
 * Wrapped in React `cache()` so the dashboard layout and the page it renders
 * share a single Clerk lookup instead of issuing one each. Returns `null` when
 * unauthenticated; callers decide whether that means `redirect` or a 403 state.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const { userId } = await auth()
  if (!userId) return null

  const user = await (await clerkClient()).users.getUser(userId)
  const role = (user.privateMetadata?.role ||
    user.publicMetadata?.role ||
    "patient") as UserRole

  const firstName =
    user.firstName ||
    user.fullName?.split(" ")[0] ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there"

  return { userId, role, firstName }
})
