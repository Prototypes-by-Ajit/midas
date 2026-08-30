import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import type { ManagedUser, UserDetail } from "@/types/dashboard"

/**
 * Server-side read of the Clerk user directory for the admin users page.
 *
 * Ported from `GET /api/admin/users`. This function does NOT check the caller's
 * role — the page gates on `getSessionUser().role === "admin"` before calling
 * it, and the route handler keeps its own check for the role-change mutation.
 *
 * Returns a result object rather than throwing so the page can render an error
 * state instead of blanking the dashboard shell.
 */
export async function getUsers(): Promise<
  { ok: true; data: ManagedUser[] } | { ok: false }
> {
  try {
    const client = await clerkClient()
    const { data: users } = await client.users.getUserList({ limit: 500 })

    return {
      ok: true,
      data: users.map((user) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
        role:
          ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
          "patient",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
      })),
    }
  } catch {
    return { ok: false }
  }
}

/**
 * FR-USR-2: one user's access facts + active sessions, for the detail view
 * linked from the directory row. Session-list read is ported from
 * `getSecurityOverview` (`security.server.ts`) — same Clerk call, no `current`
 * flag since this is always someone else's session from the admin's view.
 *
 * "Recent audit activity" (also FR-USR-2) is deliberately not queried here —
 * `audit_events` doesn't exist yet (003-admin-control-room, FR-AUD-*); the
 * page renders that section's not-available state itself rather than this
 * function faking an empty query result.
 */
export async function getUserDetail(
  userId: string,
): Promise<{ ok: true; data: UserDetail } | { ok: false }> {
  try {
    const client = await clerkClient()
    const [user, sessionList] = await Promise.all([
      client.users.getUser(userId),
      client.sessions.getSessionList({ userId, status: "active" }),
    ])

    return {
      ok: true,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
        role:
          ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
          "patient",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
        banned: user.banned,
        locked: user.locked,
        twoFactorEnabled: user.twoFactorEnabled,
        passwordEnabled: user.passwordEnabled,
        sessions: sessionList.data.map((s) => {
          const activity = s.latestActivity
          const device =
            [activity?.deviceType, activity?.browserName].filter(Boolean).join(" · ") ||
            null
          const location =
            [activity?.city, activity?.country].filter(Boolean).join(", ") || null

          return {
            id: s.id,
            device,
            location,
            lastActiveAt: new Date(s.lastActiveAt).toISOString(),
          }
        }),
      },
    }
  } catch {
    return { ok: false }
  }
}
