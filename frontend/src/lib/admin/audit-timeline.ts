import type { AuditEvent, PolicyBlockEvent } from "@/types/dashboard"

/**
 * T054's merge-sort, extracted from `app/dashboard/admin/audit/page.tsx` so
 * it's plain, vitest-importable TypeScript -- the page itself is a `.tsx`
 * Server Component and this project's vitest config doesn't process JSX
 * (confirmed: importing the page file directly fails vite's import
 * analysis), the same reason `lib/admin/governed-action.ts` exists
 * separately from `services/admin.server.ts`.
 */
export const AUDIT_PAGE_SIZE = 25

export type TimelineRow =
  | { kind: "audit"; created_at: string; row: AuditEvent }
  | { kind: "policy_block"; created_at: string; row: PolicyBlockEvent }

/**
 * Merges two independently-cursored tables (`audit_events`, `policy_block_events`
 * -- T074) into one timeline, sorted newest-first, capped to `AUDIT_PAGE_SIZE`.
 * Both sources are queried with the same `created_at` cursor, so the next
 * page's queries pick up exactly where this page's last-included row left
 * off -- no OFFSET anywhere, matching FR-AUD-2's "no skip or duplicate as the
 * table grows" requirement.
 *
 * Known, inherited edge case (ponytail): a tie on `created_at` at the exact
 * page boundary could in principle drop one row -- the same risk `/audit`'s
 * own single-table cursor already accepts (admin.py's R7 note). A compound
 * cursor would close it; not built here, since the underlying `/audit`
 * endpoint doesn't have one either.
 */
export function mergeTimeline(auditRows: AuditEvent[], policyRows: PolicyBlockEvent[]): TimelineRow[] {
  const combined: TimelineRow[] = [
    ...auditRows.map((row): TimelineRow => ({ kind: "audit", created_at: row.created_at, row })),
    ...policyRows.map((row): TimelineRow => ({ kind: "policy_block", created_at: row.created_at, row })),
  ]
  combined.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  return combined.slice(0, AUDIT_PAGE_SIZE)
}
