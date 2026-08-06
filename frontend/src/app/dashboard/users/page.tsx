import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getUsers } from "@/services/admin.server"

const UsersConsole = nextDynamic(() => import("@/comps/dashboard/users/users-console"))

export const metadata: Metadata = {
  title: "Users",
  description: "Assign roles and manage access.",
}

export const dynamic = "force-dynamic"

/**
 * Server Component. The admin gate runs here, so the directory is never sent to
 * a non-admin. `/api/admin/users` re-checks the role for the role-change PATCH.
 */
export default async function UsersPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const isAdmin = session.role === "admin"
  const result = isAdmin ? await getUsers() : null

  return (
    <UsersConsole
      users={result?.ok ? result.data : []}
      currentUserId={session.userId}
      isAdmin={isAdmin}
    />
  )
}
