import "server-only"

import { auth, clerkClient } from "@clerk/nextjs/server"

import type { SecurityOverview } from "@/types/dashboard"

/**
 * Real account security posture, read from Clerk.
 *
 * Replaces `src/data/dashboard/security.ts`, which hardcoded "Two-Factor Auth:
 * Enabled / SMS & App based" alongside three invented sessions with made-up
 * devices, cities and timestamps. That told users their account was protected
 * when it was not, and a fabricated session list actively masks the real
 * unrecognized session the panel exists to reveal.
 *
 * Follows `dashboard.server.ts`: returns a result object rather than throwing,
 * so the page renders an explicit error state instead of a blank route. Fields
 * Clerk does not supply stay null and render as "Unknown" — never backfilled.
 */
export async function getSecurityOverview(): Promise<
  { ok: true; data: SecurityOverview } | { ok: false }
> {
  try {
    const { userId, sessionId } = await auth()
    if (!userId) return { ok: false }

    const clerk = await clerkClient()
    const [user, sessionList] = await Promise.all([
      clerk.users.getUser(userId),
      clerk.sessions.getSessionList({ userId, status: "active" }),
    ])

    const sessions = sessionList.data.map((s) => {
      const activity = s.latestActivity
      // Only what Clerk actually returned. A missing device or city renders as
      // "Unknown"; inventing "MacBook Pro / New York, US" is what we removed.
      const device =
        [activity?.deviceType, activity?.browserName].filter(Boolean).join(" · ") || null
      const location = [activity?.city, activity?.country].filter(Boolean).join(", ") || null

      return {
        id: s.id,
        device,
        location,
        lastActiveAt: new Date(s.lastActiveAt).toISOString(),
        current: s.id === sessionId,
      }
    })

    return {
      ok: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        passwordEnabled: user.passwordEnabled,
        sessions,
      },
    }
  } catch {
    return { ok: false }
  }
}
