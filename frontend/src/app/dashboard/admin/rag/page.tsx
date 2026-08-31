import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { IconFolderOpen } from "@tabler/icons-react"

import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { ErrorState, PermissionDenied, EmptyState } from "@/components/clinical/states"
import { StatusBadge, type StatusTone } from "@/components/clinical/status-badge"
import { getSessionUser } from "@/services/auth.server"
import { getRagIngestion, getRagIndexHealth } from "@/services/admin.server"
import { emitAdminEvent } from "@/lib/admin/analytics"
import type { AdminDocumentRow } from "@/types/dashboard"

export const metadata: Metadata = {
  title: "RAG operations",
  description: "Index health and the ingestion queue.",
}

export const dynamic = "force-dynamic"

const NA = "—"

/**
 * FR-RAG-1 (base half)/FR-RAG-3/FR-RAG-5 (T053). No poll requirement in
 * spec.md for this view -- pure SSR, both calls in parallel. Same no-local-
 * gate pattern as the other admin pages (F5).
 */
export default async function AdminRagPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const actor = { id: session.userId, role: session.role }
  const [ingestion, indexHealth] = await Promise.all([getRagIngestion(actor), getRagIndexHealth(actor)])

  // Both calls carry the same role gate -- if one is refused the other is
  // too, so either result's status stands for the page as a whole.
  const denied = !ingestion.ok && ingestion.status === 403
  const failed = !ingestion.ok || !indexHealth.ok

  // T061 -- PRD §17. "Degraded" here means failed-ingestion sources -- the
  // closest RAG-specific analog to Overview/Health's per-source signal.
  const degradedSourcesCount = ingestion.ok
    ? ingestion.data.documents.filter((d) => d.status === "failed").length
    : null
  emitAdminEvent("admin_view_opened", { role: session.role, view: "rag", degraded_sources_count: degradedSourcesCount })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="RAG operations" description="Index health and the technical ingestion queue." />

      {/* FR-RAG-5: on-surface on first load, not behind a tooltip. */}
      <div role="note" className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-foreground">
        This console handles technical ingestion only. No source auto-publishes to retrieval from here.
      </div>

      {denied ? (
        <PermissionDenied requiredRole="Admin, ML Engineer, or SRE" />
      ) : failed ? (
        <ErrorState />
      ) : (
        <>
          <section aria-labelledby="index-health-heading">
            <SectionHeading id="index-health-heading" title="Index health" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
              <Fact term="Chunk count" value={indexHealth.data.chunk_count.toLocaleString()} />
              <Fact term="Approved sources" value={indexHealth.data.approved_sources.toLocaleString()} />
              <Fact term="Embedding model(s)" value={indexHealth.data.embedding_models.join(", ") || NA} />
              <Fact term="Last rebuild" value={indexHealth.data.last_rebuild_at ? new Date(indexHealth.data.last_rebuild_at).toLocaleString() : NA} />
              <Fact term="Stale sources" value={indexHealth.data.stale_sources?.toLocaleString() ?? NA} />
              <Fact term="Pending approvals" value={indexHealth.data.pending_approvals?.toLocaleString() ?? NA} />
            </dl>
          </section>

          <section aria-labelledby="ingestion-heading">
            <SectionHeading id="ingestion-heading" title="Ingestion queue" />
            {ingestion.data.documents.length === 0 ? (
              <EmptyState
                icon={IconFolderOpen}
                title="Nothing ingested yet"
                body="Sources appear here once a document upload starts processing."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">Ingestion queue, most recent first.</caption>
                  <thead className="border-b bg-surface text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Origin</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ingestion.data.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-4 py-3 font-medium text-foreground">{doc.title || doc.file_name || doc.id}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={documentStatusTone(doc.status)} dot>
                            {documentStatusLabel(doc.status)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.source ?? NA}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(doc.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  )
}

/**
 * `documents.status` (R6, base half only -- 4 values, no quarantine) has no
 * shared tone mapping yet (`processTone` in status-badge.tsx doesn't cover
 * "processed"/"pending" the way this table needs); a local mapper here is
 * cheaper than extending a shared file for the one page that needs it.
 */
function documentStatusTone(status: AdminDocumentRow["status"]): StatusTone {
  switch (status) {
    case "processed":
      return "success"
    case "processing":
    case "pending":
      return "warning"
    case "failed":
      return "critical"
  }
}

function documentStatusLabel(status: AdminDocumentRow["status"]): string {
  switch (status) {
    case "processed":
      return "Processed"
    case "processing":
      return "Processing"
    case "pending":
      return "Pending"
    case "failed":
      return "Failed"
  }
}
