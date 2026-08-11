import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * Server-side read of the signed-in user's generated reports.
 *
 * Replaces the two browser queries in `comps/dashboard/history/history-console.tsx`,
 * which ran `supabase.from('generated_reports')` from an anon-key client with no
 * user predicate at all — only `analysis_id` and `report_type` — and then minted
 * signed URLs on `report_storage` from the same client. Those failed closed only
 * because the table's RLS compared a Supabase Auth UUID with a Clerk id and could
 * never match. That is accidental safety, not enforcement (Constitution III).
 *
 * Service-role client, so the `.eq("user_id", userId)` scope is mandatory on every
 * query in this file. There are no exceptions here: `generated_reports` is never
 * shared.
 *
 * Returns result objects rather than throwing, matching `analysis.server.ts` and
 * `dashboard.server.ts`, so a page renders its own error state instead of falling
 * through to the route error boundary.
 */

/**
 * A `generated_reports` row. Provenance is optional — see the select comment.
 *
 * A `type` rather than an `interface` so it carries an implicit index signature:
 * the console consumes these rows through `hydrateReports`, whose row type is
 * open-ended precisely because a historical row may carry columns this list does
 * not name. An interface would not be assignable to it.
 */
export type GeneratedReportRow = {
  id: string
  user_id: string
  analysis_id: string
  report_type: string
  report_number: string
  generation_status: string
  storage_path: string | null
  error_message: string | null
  generated_at: string | null
  created_at: string
  sections_generated?: Record<string, boolean> | null
  generator?: string | null
  degraded_reason?: string | null
}

/**
 * `select("*")` rather than an explicit column list, deliberately.
 *
 * `sections_generated`, `generator` and `degraded_reason` arrive with migration
 * 014. Naming them explicitly would make every query here fail against a database
 * that has not run it yet, which would break the history page on any environment
 * mid-rollout. A star select returns whatever exists, and the three fields are
 * optional on the type above so a pre-014 row type-checks. The table is narrow;
 * the over-fetch is a few small columns.
 */
const ALL_COLUMNS = "*"

export async function getReportsForUser(
  userId: string
): Promise<{ ok: true; data: GeneratedReportRow[] } | { ok: false }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }

  try {
    const { data, error } = await supabase
      .from("generated_reports")
      .select(ALL_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) return { ok: false }
    return { ok: true, data: (data ?? []) as GeneratedReportRow[] }
  } catch {
    return { ok: false }
  }
}

/**
 * The newest report per analysis, keyed by `analysis_id`.
 *
 * The history console needs a report **id** to reach the preview and download
 * routes, and it cannot look one up itself any more. One query, newest first,
 * keeping the first row seen per analysis — so the console reuses an existing
 * report instead of generating a duplicate on every click. Reports are immutable
 * and generation is not idempotent: a second POST creates a second row.
 *
 * `reportType` is optional, and the history page no longer passes one. It used to
 * pin the lookup to `patient_report`, matching a hard-coded request type in the
 * console. Once T064 let the person choose any of the four, that filter became a
 * trap: a clinician report generated from that page would not appear in this map,
 * the console would believe no report existed, and the next click would mint
 * another immutable duplicate.
 */
export async function getLatestReportsByAnalysis(
  userId: string,
  reportType?: string
): Promise<{ ok: true; data: Record<string, GeneratedReportRow> } | { ok: false }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }

  try {
    let query = supabase
      .from("generated_reports")
      .select(ALL_COLUMNS)
      .eq("user_id", userId)

    if (reportType) query = query.eq("report_type", reportType)

    const { data, error } = await query
      .order("created_at", { ascending: false })

    if (error) return { ok: false }

    const latest: Record<string, GeneratedReportRow> = {}
    for (const row of (data ?? []) as GeneratedReportRow[]) {
      if (!latest[row.analysis_id]) latest[row.analysis_id] = row
    }
    return { ok: true, data: latest }
  } catch {
    return { ok: false }
  }
}

export type ReportOwnerResult =
  | { ok: true; report: GeneratedReportRow }
  | { ok: false; reason: "not_found" | "forbidden" | "unavailable" }

/**
 * The single owner check, shared by the preview and download routes.
 *
 * One predicate in one place: two routes that each write their own check are two
 * routes that can disagree, and the download route already carries a different
 * one (a dormant `clinician_id` branch, removed by T050).
 *
 * The scoped query runs first and is the only one that returns row data. A miss
 * escalates to an existence probe that selects the id alone — enough to answer
 * 403 versus 404 without any of the row crossing the boundary. The contract
 * distinguishes those two codes; neither body says anything beyond the code
 * (FR-009).
 */
export async function assertReportOwner(
  reportId: string,
  userId: string
): Promise<ReportOwnerResult> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, reason: "unavailable" }

  try {
    const { data, error } = await supabase
      .from("generated_reports")
      .select(ALL_COLUMNS)
      .eq("id", reportId)
      .eq("user_id", userId)
      .maybeSingle()

    if (error) return { ok: false, reason: "unavailable" }
    if (data) return { ok: true, report: data as GeneratedReportRow }

    const { data: exists } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle()

    return { ok: false, reason: exists ? "forbidden" : "not_found" }
  } catch {
    return { ok: false, reason: "unavailable" }
  }
}
