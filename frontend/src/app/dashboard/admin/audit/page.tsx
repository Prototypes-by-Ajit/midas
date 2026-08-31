import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { IconInbox } from "@tabler/icons-react"

import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied, EmptyState } from "@/components/clinical/states"
import { StatusBadge, type StatusTone } from "@/components/clinical/status-badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { getSessionUser } from "@/services/auth.server"
import { getAuditEvents, getPolicyBlockEvents, getPolicyBlockSummary } from "@/services/admin.server"
import { AUDIT_ACTIONS } from "@/lib/admin/contract"
import { AUDIT_PAGE_SIZE as PAGE_SIZE, mergeTimeline } from "@/lib/admin/audit-timeline"
import { emitAdminEvent } from "@/lib/admin/analytics"
import type { AuditEvent } from "@/types/dashboard"

export const metadata: Metadata = {
  title: "Audit & incidents",
  description: "Every governed action and policy block, one timeline.",
}

export const dynamic = "force-dynamic"

const outcomeTone: Record<AuditEvent["outcome"], StatusTone> = {
  allowed: "success",
  refused: "critical",
  pending: "warning",
}

/**
 * FR-AUD-2/FR-AUD-4 (T054). Filter and pagination are plain URL search
 * params -- a `<form method="get">` and `<Link>` navigation, server-rendered,
 * no client fetch. Same no-local-role-gate pattern as the other admin pages.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; cursor?: string }>
}) {
  const { q, action, cursor } = await searchParams
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const actor = { id: session.userId, role: session.role }
  // `policy_block_events` has neither a `q` nor an `action` column to filter
  // on (T007 -- no actor_id, no query-text column, by construction) -- a
  // search/action filter is scoped to `audit_events` only. Fetching policy
  // blocks anyway and merging them in unfiltered would silently violate
  // FR-AUD-2 (a search for one action still showing unrelated policy-block
  // rows, and counting them in the result count) -- so this source is
  // treated as exhausted, not fetched, whenever either filter is active.
  const filtering = Boolean(q || action)
  const [auditResult, policyResult, summaryResult] = await Promise.all([
    getAuditEvents(actor, { q, action, cursor, limit: String(PAGE_SIZE) }),
    filtering
      ? Promise.resolve({ ok: true as const, data: { items: [], next_cursor: null, result_count: 0 } })
      : getPolicyBlockEvents(actor, { cursor, limit: String(PAGE_SIZE) }),
    getPolicyBlockSummary(actor),
  ])

  const denied = !auditResult.ok && auditResult.status === 403
  const failed = !auditResult.ok || !policyResult.ok

  // T061 -- PRD §17. "Degraded" here: refused/pending rows in this page, the
  // audit view's own analog to a service being unhealthy.
  const degradedSourcesCount = auditResult.ok
    ? auditResult.data.items.filter((r) => r.outcome !== "allowed").length
    : null
  emitAdminEvent("admin_view_opened", { role: session.role, view: "audit", degraded_sources_count: degradedSourcesCount })

  const timeline = auditResult.ok && policyResult.ok ? mergeTimeline(auditResult.data.items, policyResult.data.items) : []
  // Either source having a full page means there's more beyond this merged
  // page -- the true boundary is the oldest row we actually rendered.
  const hasMore =
    auditResult.ok && policyResult.ok &&
    (auditResult.data.items.length === PAGE_SIZE || policyResult.data.items.length === PAGE_SIZE) &&
    timeline.length > 0
  const nextCursor = hasMore ? timeline[timeline.length - 1].created_at : null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Audit & incidents" description="Governed actions and safety-guardrail policy blocks, one timeline." />

      {/* FR-AUD-4: aggregate signal, visible without running a search. */}
      {summaryResult.ok && (
        <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4 text-sm">
          <span className="text-foreground">
            <strong className="tabular-nums">{summaryResult.data.recent_count_24h}</strong> policy blocks in the last 24h
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground">
            <strong className="tabular-nums">{summaryResult.data.escalated_and_unreviewed_count}</strong> escalated and unreviewed
          </span>
        </div>
      )}

      {denied ? (
        <PermissionDenied requiredRole="Admin or SRE" />
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-q">Search</Label>
              <Input id="audit-q" name="q" defaultValue={q ?? ""} placeholder="Actor, target, or event id" className="min-h-11 w-64" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-action">Action</Label>
              <select
                id="audit-action"
                name="action"
                defaultValue={action ?? ""}
                className="border-input bg-background flex min-h-11 w-56 rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="">All actions</option>
                {AUDIT_ACTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="min-h-11">Filter</Button>
            {(q || action) && (
              <Link href="/dashboard/admin/audit" className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline">
                Clear
              </Link>
            )}
          </form>

          {failed ? (
            <ErrorState />
          ) : (
            <section aria-labelledby="timeline-heading">
              <SectionHeading
                id="timeline-heading"
                title={`${timeline.length} result${timeline.length === 1 ? "" : "s"}${timeline.length > 0 ? ` · ${new Date(timeline[timeline.length - 1].created_at).toLocaleString()} – ${new Date(timeline[0].created_at).toLocaleString()}` : ""}`}
              />
              {filtering && (
                <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                  Policy blocks aren&apos;t shown while filtering (no search or action column exists on that
                  table) — clear the filter to see them interleaved.
                </p>
              )}
              {timeline.length === 0 ? (
                <EmptyState icon={IconInbox} title="No matching events" body="Nothing in the audit trail matches this filter yet." />
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Audit and policy-block timeline, newest first.</caption>
                    <thead className="border-b bg-surface text-left text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Kind</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Actor / subject</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Action</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Target</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {timeline.map((item) =>
                        item.kind === "audit" ? (
                          <tr key={item.row.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3"><StatusBadge tone="neutral">Operator</StatusBadge></td>
                            <td className="px-4 py-3 text-foreground">{item.row.actor_id} <span className="text-xs text-muted-foreground">({item.row.actor_role})</span></td>
                            <td className="px-4 py-3 text-muted-foreground">{item.row.action}</td>
                            <td className="px-4 py-3 text-muted-foreground">{item.row.target_id}</td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={outcomeTone[item.row.outcome]} dot>
                                {item.row.outcome}
                              </StatusBadge>
                            </td>
                          </tr>
                        ) : (
                          // Policy-block rows: visually distinguished (tinted
                          // row, "Policy block" kind badge) from operator rows
                          // in the same timeline (FR-AUD-4).
                          <tr key={item.row.id} className="bg-warning-subtle/40">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3"><StatusBadge tone="warning">Policy block</StatusBadge></td>
                            <td className="px-4 py-3 text-foreground">{item.row.subject_role}</td>
                            <td className="px-4 py-3 text-muted-foreground">{item.row.classification}</td>
                            <td className="px-4 py-3 text-muted-foreground">—</td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={item.row.escalated_to_review ? "critical" : "neutral"}>
                                {item.row.escalated_to_review ? "Escalated" : "Logged"}
                              </StatusBadge>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {nextCursor && (
                <div className="mt-3 flex justify-end">
                  <Link
                    href={{ pathname: "/dashboard/admin/audit", query: { q, action, cursor: nextCursor } }}
                    className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Older →
                  </Link>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
