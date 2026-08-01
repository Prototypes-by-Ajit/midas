import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { DashboardOverview, RecentActivityItem, ServiceProbe } from "@/types/dashboard"

/**
 * Server-side data access for the dashboard overview.
 *
 * Uses the service-role key, which bypasses RLS — every query here MUST be
 * scoped with `.eq("user_id", userId)` using the id from Clerk `auth()`.
 *
 * Route handlers each build their own client with slightly different env
 * precedence; this reads both spellings so it works wherever they do.
 */
function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const PENDING_ANALYSIS = ["pending", "processing"]
const PENDING_REPORT = ["pending", "processing"]

/**
 * Everything the overview needs, in one round trip set.
 *
 * Returns a result object rather than throwing so the page can render its
 * explicit error state instead of falling through to the route error boundary
 * — a failed metric read should not blank out navigation the user can still use.
 */
export async function getDashboardOverview(
  userId: string
): Promise<{ ok: true; data: DashboardOverview } | { ok: false }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }

  try {
    const [analysesRes, reportsRes] = await Promise.all([
      supabase
        .from("medical_analyses")
        .select("id, image_name, diagnosis, risk_level, confidence, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("generated_reports")
        .select("id, report_number, report_type, generation_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ])

    if (analysesRes.error || reportsRes.error) return { ok: false }

    const analyses = analysesRes.data ?? []
    const reports = reportsRes.data ?? []

    const completed = analyses.filter((a) => a.confidence != null)
    const avgConfidence =
      completed.length > 0
        ? completed.reduce((sum, a) => sum + (a.confidence ?? 0), 0) / completed.length
        : null

    const pendingWork =
      analyses.filter((a) => PENDING_ANALYSIS.includes(a.status ?? "")).length +
      reports.filter((r) => PENDING_REPORT.includes(r.generation_status ?? "")).length

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentAnalyses = analyses.filter(
      (a) => a.created_at && new Date(a.created_at).getTime() >= sevenDaysAgo
    ).length

    // One merged, newest-first stream so the user sees what happened, not two
    // lists they have to interleave themselves.
    const activity: RecentActivityItem[] = [
      ...analyses.slice(0, 8).map((a) => ({
        id: `analysis-${a.id}`,
        kind: "analysis" as const,
        title: a.diagnosis || a.image_name || "Image analysis",
        status: a.status ?? "unknown",
        risk: a.risk_level ?? null,
        timestamp: a.created_at,
        href: "/dashboard/history",
      })),
      ...reports.slice(0, 8).map((r) => ({
        id: `report-${r.id}`,
        kind: "report" as const,
        title: r.report_number || "Report",
        status: r.generation_status ?? "unknown",
        risk: null,
        timestamp: r.created_at,
        href: "/dashboard/reports",
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
      )
      .slice(0, 6)

    return {
      ok: true,
      data: {
        totalAnalyses: analyses.length,
        recentAnalyses,
        totalReports: reports.length,
        pendingWork,
        avgConfidence,
        activity,
      },
    }
  } catch {
    return { ok: false }
  }
}

function backendBaseUrl() {
  const raw = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!raw) return null
  const trimmed = raw.trim()
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "")
}

/**
 * Genuine reachability checks — nothing here is hardcoded.
 *
 * `/api/health` in this app is a stub that always returns ok, so it is
 * deliberately NOT used; that would be a fake signal. We probe the Python
 * backend's real health endpoint and do a trivial scoped read against
 * Postgres. Anything we cannot actually determine reports as "unknown"
 * rather than inventing "operational".
 *
 * Called from a Suspense boundary so a slow or hanging dependency delays only
 * this panel, never the page.
 */
export async function getServiceStatus(userId: string): Promise<ServiceProbe[]> {
  const [inference, database] = await Promise.all([
    probeBackend(),
    probeDatabase(userId),
  ])
  return [inference, database]
}

async function probeBackend(): Promise<ServiceProbe> {
  const base = backendBaseUrl()
  if (!base) {
    return {
      service: "Analysis service",
      status: "unknown",
      detail: "Not configured in this environment",
    }
  }
  try {
    const res = await fetch(`${base}/api/v1/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    return res.ok
      ? { service: "Analysis service", status: "operational", detail: "Responding" }
      : {
          service: "Analysis service",
          status: "degraded",
          detail: `Responded ${res.status}`,
        }
  } catch {
    return {
      service: "Analysis service",
      status: "offline",
      detail: "No response",
    }
  }
}

async function probeDatabase(userId: string): Promise<ServiceProbe> {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return {
      service: "Records database",
      status: "unknown",
      detail: "Not configured in this environment",
    }
  }
  try {
    const { error } = await supabase
      .from("medical_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    return error
      ? { service: "Records database", status: "degraded", detail: "Query failed" }
      : { service: "Records database", status: "operational", detail: "Reachable" }
  } catch {
    return { service: "Records database", status: "offline", detail: "Unreachable" }
  }
}
