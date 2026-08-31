import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied } from "@/components/clinical/states"
import { OverviewPoll } from "@/components/admin/overview-poll"
import { getSessionUser } from "@/services/auth.server"
import { getOverview } from "@/services/admin.server"
import { emitAdminEvent } from "@/lib/admin/analytics"

export const metadata: Metadata = {
  title: "Admin overview",
  description: "Console-wide status at a glance.",
}

/** Personalized, role-checked data -- never cached across sessions. */
export const dynamic = "force-dynamic"

/**
 * FR-OV-1/FR-OV-2 (T051). Server Component -- the four tiles' *first* paint
 * and the seven-panel grid both come from the server; only the tiles' 30s
 * refresh (`OverviewPoll`) is a client island.
 *
 * No local role gate before the fetch (unlike the pre-existing `/dashboard/
 * queue` pattern this feature otherwise reuses): every authenticated user
 * reaches `getOverview()`, which always calls FastAPI with their real role
 * header. A denied request still gets logged there (`overview.read.refused`)
 * -- a local pre-check here would let a direct-URL visit reach a dead end
 * FastAPI never sees, undercounting SC-003 (speckit-analyze finding F5).
 */
export default async function AdminOverviewPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getOverview({ id: session.userId, role: session.role })

  // T061 -- PRD §17. `degraded_sources_count`: how many of the four tiles
  // came back "—" (no source available) rather than a real value.
  const degradedSourcesCount = result.ok
    ? Object.values(result.data.tiles).filter((v) => v == null).length
    : null
  emitAdminEvent("admin_view_opened", { role: session.role, view: "overview", degraded_sources_count: degradedSourcesCount })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Overview"
        description="Console-wide status across services, RAG, and the audit trail."
      />

      {!result.ok ? (
        result.status === 403 ? (
          <PermissionDenied requiredRole="Admin, ML Engineer, or SRE" />
        ) : (
          <ErrorState />
        )
      ) : (
        <>
          <OverviewPoll initial={result.data} />
          <PanelGrid />
        </>
      )}
    </div>
  )
}

/**
 * FR-OV-2's seven panels. Which name maps to which workspace is an
 * unresolved decision upstream (design review Pass 7, plan.md) -- this picks
 * the direct mapping (each live panel deep-links to the view this feature
 * itself builds) rather than blocking on it. Three panels stay disabled:
 * Model Registry, Evaluation Center, and Fine-Tuning Center depend on
 * ML-platform infrastructure this release does not build (D4, R036).
 */
const LIVE_PANELS = [
  { title: "System Health", description: "Service status, latency, and error rate.", href: "/dashboard/admin/health" },
  { title: "RAG Operations", description: "Index health and the ingestion queue.", href: "/dashboard/admin/rag" },
  { title: "Users & Roles", description: "Operator accounts, invites, and role changes.", href: "/dashboard/users" },
  { title: "Audit & Incidents", description: "Every governed action and policy block.", href: "/dashboard/admin/audit" },
] as const

const DISABLED_PANELS = [
  { title: "Model Registry", description: "No model registry exists yet." },
  { title: "Evaluation Center", description: "No evaluation harness exists yet." },
  { title: "Fine-Tuning Center", description: "No training pipeline exists yet." },
] as const

function PanelGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Console areas">
      {LIVE_PANELS.map((panel) => (
        <Link
          key={panel.title}
          href={panel.href}
          role="listitem"
          className="flex min-h-11 flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="text-sm font-medium text-foreground">{panel.title}</span>
          <span className="text-xs text-muted-foreground">{panel.description}</span>
        </Link>
      ))}
      {DISABLED_PANELS.map((panel) => (
        <div
          key={panel.title}
          role="listitem"
          className="flex min-h-11 flex-col gap-1 rounded-xl border border-dashed bg-card/50 p-4 opacity-60"
        >
          <span className="text-sm font-medium text-foreground">{panel.title}</span>
          <span className="text-xs text-muted-foreground">{panel.description} Not yet available.</span>
        </div>
      ))}
    </div>
  )
}
