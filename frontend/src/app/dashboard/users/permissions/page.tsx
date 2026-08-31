import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied } from "@/components/clinical/states"
import { StatusBadge, type StatusTone } from "@/components/clinical/status-badge"
import { getSessionUser } from "@/services/auth.server"
import { getPermissionsMatrix } from "@/services/admin.server"
import type { PermissionsMatrixRow } from "@/types/dashboard"

export const metadata: Metadata = {
  title: "Roles & permissions",
  description: "What each operator role can see and do.",
}

export const dynamic = "force-dynamic"

const LEVEL_TONE: Record<PermissionsMatrixRow["admin"], StatusTone> = {
  manage: "success",
  view: "active",
  none: "neutral",
}

const LEVEL_LABEL: Record<PermissionsMatrixRow["admin"], string> = {
  manage: "Manage",
  view: "View",
  none: "—",
}

/**
 * FR-USR-6 (T073). Reachable by all three operator roles independent of the
 * Users & Roles gate (T033's fix) -- read-only reference content, not an
 * operational control. `/dashboard/users/*` per navigation.ts's own comment
 * (R2's "extended in place" family, not `/dashboard/admin/*`).
 */
export default async function PermissionsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getPermissionsMatrix({ id: session.userId, role: session.role })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Roles & permissions"
        description="Reference only -- what Admin, ML Engineer, and SRE can each see and do."
        crumbs={[{ label: "Users", href: "/dashboard/users" }, { label: "Roles & permissions" }]}
      />

      {!result.ok ? (
        result.status === 403 ? (
          <PermissionDenied requiredRole="Admin, ML Engineer, or SRE" />
        ) : (
          <ErrorState />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Permissions matrix by operator role.</caption>
            <thead className="border-b bg-surface text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Area</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Admin</th>
                <th scope="col" className="px-4 py-2.5 font-medium">ML Engineer</th>
                <th scope="col" className="px-4 py-2.5 font-medium">SRE</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.data.matrix.map((row) => (
                <tr key={row.area}>
                  <td className="px-4 py-3 font-medium text-foreground">{row.area}</td>
                  <td className="px-4 py-3"><Level level={row.admin} /></td>
                  <td className="px-4 py-3"><Level level={row.ml_engineer} /></td>
                  <td className="px-4 py-3"><Level level={row.sre} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Level({ level }: { level: PermissionsMatrixRow["admin"] }) {
  return (
    <StatusBadge tone={LEVEL_TONE[level]} dot={level !== "none"}>
      {LEVEL_LABEL[level]}
    </StatusBadge>
  )
}
