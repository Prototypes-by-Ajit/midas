import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { IconInbox } from "@tabler/icons-react"

import { PageHeader } from "@/components/clinical/page-header"
import { StatusBadge } from "@/components/clinical/status-badge"
import { EmptyState, ErrorState } from "@/components/clinical/states"
import { PermissionDenied } from "@/components/clinical/states"
import {
  formatWaitTime,
  hasNoUsableResult,
  presentCaseState,
  presentSharedState,
} from "@/data/clinical/case-presentation"
import { getReviewQueue } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

export const metadata: Metadata = {
  title: "Review queue",
  description: "Cases waiting for clinical review.",
}

/**
 * Personalized clinical data — must never be served from a shared cache.
 * `auth()` already forces dynamic rendering; this states the requirement so a
 * later `revalidate` cannot quietly make one clinician's work list cacheable.
 */
export const dynamic = "force-dynamic"

/**
 * The clinician work list. **Server Component** — no `"use client"` anywhere in
 * this file, so the queue is in the first HTML rather than after a hydration
 * round trip.
 *
 * The role check here is display gating and nothing more. `GET /api/clinical/queue`
 * re-checks with `getSessionUser()` before it queries, and that check is the one
 * T019 asserts. This page being unreachable proves nothing about the data
 * (FR-034); it exists so a patient who follows a link sees an explanation instead
 * of an empty table.
 *
 * Wait time is the lead scan column because the question this page answers is
 * "what has been waiting longest" — the service already orders oldest-first, and
 * putting the answer first means a clinician does not have to read the rows to
 * find it.
 */
export default async function QueuePage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  if (session.role !== "clinician") {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Review queue" />
        <PermissionDenied requiredRole="clinician" />
      </div>
    )
  }

  const queue = await getReviewQueue(session.userId)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Review queue"
        description="Cases waiting for a clinician, oldest first. Claiming a case takes it off everyone else's list."
      />

      {!queue.ok ? (
        <ErrorState
          title={presentSharedState("clinician", "error").label}
          body={presentSharedState("clinician", "error").description}
        />
      ) : queue.data.length === 0 ? (
        <EmptyState
          icon={IconInbox}
          title={presentSharedState("clinician", "empty").label}
          body={presentSharedState("clinician", "empty").description}
        />
      ) : (
        <QueueList
          rows={queue.data.map((row) => ({
            id: row.id,
            waited: formatWaitTime(row.waited_ms),
            state: row.review_state,
            mine: Boolean(row.claimed_by),
            noResult: hasNoUsableResult({ status: row.status, diagnosis: row.diagnosis }),
          }))}
        />
      )}
    </div>
  )
}

interface QueueRowView {
  id: string
  waited: string
  state: string | null
  mine: boolean
  noResult: boolean
}

/**
 * One list, two layouts.
 *
 * Below `md` the table collapses to the card-list pattern the reports console
 * already uses — a table with five columns on a phone either scrolls sideways or
 * truncates, and a clinician triaging on a ward does the second thing by
 * accident. Both layouts render the same rows from the same source, so they
 * cannot disagree; only one is visible at a time.
 */
function QueueList({ rows }: { rows: QueueRowView[] }) {
  return (
    <>
      {/* Cards, below md */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/dashboard/queue/${row.id}`}
              className="flex min-h-11 flex-col gap-2 rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  Waiting {row.waited}
                </span>
                <CaseStateBadge state={row.state} />
              </div>
              <span className="text-xs text-muted-foreground">
                Case {row.id.slice(0, 8)}
                {row.mine && " · yours"}
              </span>
              {row.noResult && <NoResultLine />}
            </Link>
          </li>
        ))}
      </ul>

      {/* Table, md and up */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Cases waiting for clinical review, longest wait first.
          </caption>
          <thead className="border-b bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Waiting</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Case</th>
              <th scope="col" className="px-4 py-2.5 font-medium">State</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Model result</th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-foreground">{row.waited}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.id.slice(0, 8)}
                  {row.mine && (
                    <span className="ml-2 text-xs text-muted-foreground">yours</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <CaseStateBadge state={row.state} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.noResult ? <NoResultLine /> : "Available"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/queue/${row.id}`}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Open<span className="sr-only"> case {row.id.slice(0, 8)}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** The label is the accessible name; the tone only tints it (FR-041). */
function CaseStateBadge({ state }: { state: string | null }) {
  const cell = presentCaseState("clinician", state)
  if (!cell) return null
  return (
    <StatusBadge tone={cell.tone} dot>
      {cell.label}
    </StatusBadge>
  )
}

/**
 * T037: an analysis that produced nothing is a case for a human, not a fault.
 * Plain text in the ordinary row — no `ErrorState`, no critical tone, nothing
 * that reads as breakage (FR-042, SC-006).
 */
function NoResultLine() {
  return (
    <span className="text-xs text-muted-foreground">
      {presentSharedState("clinician", "no_result").description}
    </span>
  )
}
