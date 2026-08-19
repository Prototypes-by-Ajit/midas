import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type {
  AnalysisRecord,
  HistoryEntry,
  ReportRow,
  RiskLevel,
} from "@/types/dashboard"

/**
 * Server-side read of the signed-in user's analysis history.
 *
 * Replaces the client-side `AnalyticsContext`, which fetched
 * `GET /api/analysis/history` from a globally-mounted provider — so the request
 * fired on marketing pages too, and history/reports rendered empty until it
 * resolved. That route handler still exists as the BFF contract; this is the
 * same query run where the page is rendered.
 *
 * Service-role client, so the `.eq("user_id", userId)` scope is mandatory.
 *
 * Returns a result object rather than throwing so pages can render their own
 * error state instead of falling through to the route error boundary.
 */
export async function getAnalysisHistory(
  userId: string
): Promise<{ ok: true; data: AnalysisRecord[] } | { ok: false }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }

  try {
    // Deliberately narrower than the route handler's `select("*")`: that one
    // also resolves a signed heatmap URL per row against two storage buckets,
    // which is one network call per analysis for a field neither the history
    // nor the reports console reads. The analysis page gets its heatmap from
    // the POST /api/analysis/analyze response instead.
    const { data, error } = await supabase
      .from("medical_analyses")
      .select(
        // `review_state` is additive (migration 015). Every pre-feature row holds
        // NULL, which the presentation layer renders as nothing at all for a
        // patient (G3) — so adding the column changes no existing output.
        //
        // `status` is the other half of `hasNoUsableResult` (T043). Without it
        // the console can only detect a missing diagnosis, and a row that failed
        // outright while still carrying a stale diagnosis string would render as
        // a result. Reading one more existing column is cheaper than being wrong
        // about which of those two a case is.
        "id, user_id, image_name, image_url, confidence, diagnosis, risk_level, recommendations, created_at, processing_time, review_state, status"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) return { ok: false }

    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        image_name: row.image_name,
        image_url: row.image_url,
        confidence: row.confidence,
        diagnosis: row.diagnosis,
        risk_level: row.risk_level as RiskLevel,
        recommendations: row.recommendations ?? [],
        analysis_date: row.created_at,
        processing_time: row.processing_time ?? 0,
        review_state: row.review_state ?? null,
        status: row.status ?? null,
      })),
    }
  } catch {
    return { ok: false }
  }
}

/**
 * Shape an analysis record for the history console.
 *
 * Moved verbatim out of the old `history/page.tsx` render body, where it re-ran
 * on every keystroke in the search box.
 */
export function toHistoryEntry(analysis: AnalysisRecord): HistoryEntry {
  return {
    id: analysis.id,
    timestamp: analysis.analysis_date,
    diagnosis: analysis.diagnosis,
    confidence: analysis.confidence,
    risk_level: analysis.risk_level,
    analysisTime: Math.round(analysis.processing_time / 1000),
    imageUrl: analysis.image_url,
    imageName: analysis.image_name,
    imageSize: "Unknown", // Would be better to store this
    notes: `Processed in ${Math.round(analysis.processing_time / 1000)}s`,
    review_state: analysis.review_state,
    status: analysis.status ?? null,
  }
}

/**
 * Shape an analysis record for the reports console.
 *
 * Moved verbatim out of the old `reports/page.tsx` render body. Every completed
 * analysis counts as a report, hence the constant status.
 */
export function toReportRow(analysis: AnalysisRecord): ReportRow {
  return {
    id: analysis.id,
    shortId: analysis.id.slice(0, 8),
    date: analysis.analysis_date,
    diagnosis: analysis.diagnosis,
    confidence: analysis.confidence,
    risk_level: analysis.risk_level,
    status: "completed",
    imageUrl: analysis.image_url,
    analysisTime: Math.round(analysis.processing_time / 1000),
    imageSize: "Unknown", // Would be better to store this in analysis
    notes: `Processed in ${Math.round(analysis.processing_time / 1000)}s`,
  }
}
