import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import type { ManagedUser } from "@/types/dashboard"

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
