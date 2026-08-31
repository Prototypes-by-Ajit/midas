import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/clinical/page-header"
import { PermissionDenied } from "@/components/clinical/states"
import { getSessionUser } from "@/services/auth.server"
import { getUsers, writeRoleDenialAuditRow } from "@/services/admin.server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { emitAdminEvent } from "@/lib/admin/analytics"

const UsersConsole = nextDynamic(() => import("@/comps/dashboard/users/users-console"))

export const metadata: Metadata = {
  title: "Users",
  description: "Assign roles and manage access.",
}

export const dynamic = "force-dynamic"

/**
 * Server Component. The admin gate runs here, so the directory is never sent
 * to a non-admin. `/api/admin/users/[id]/role` and `/offboard` (T039/T040)
 * re-check the role independently for every governed write.
 *
 * A denied visit now writes its own `users.read.refused` audit row
 * (speckit-implement, Phase 10 finding) -- this page used to render an empty
 * "Access Denied" card with nothing behind it, the one surface in this
 * feature's Access Denial Logging pattern (spec.md) that silently didn't log
 * (T034's own architecture-correction note: this route has no FastAPI layer
 * to catch the denial, so the BFF must write it itself, same as T038-T040).
 *
 * `?view=operators` (T034, FR-USR-1, user decision 2026-08-30): the
 * directory's own operator-only tab, layered on top of the pre-existing
 * "All users" behavior rather than replacing it -- see `getUsers()`'s own
 * doc comment for why hard-filtering the only patient/clinician role-
 * management surface in the app was rejected.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const isAdmin = session.role === "admin"

  // T061 -- PRD §17. No per-source degraded signal exists for a Clerk-backed
  // directory (unlike Overview/Health's null-tile / non-operational counts).
  emitAdminEvent("admin_view_opened", { role: session.role, view: "users", degraded_sources_count: null })

  if (!isAdmin) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      await writeRoleDenialAuditRow(
        supabase,
        { id: session.userId, role: session.role },
        "users.read.refused",
        "users.directory",
      )
    }
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Users" />
        <PermissionDenied requiredRole="Admin" />
      </div>
    )
  }

  const operatorOnly = view === "operators"
  const result = await getUsers({ operatorOnly })

  return (
    <UsersConsole
      users={result.ok ? result.data : []}
      currentUserId={session.userId}
      operatorOnly={operatorOnly}
      fetchFailed={!result.ok}
    />
  )
}
