import type { TablerIcon } from "@tabler/icons-react";

/**
 * Shapes for the `src/data/dashboard/*` content modules.
 *
 * Same rule as the (home) data modules: `icon` is a component *reference*, never
 * a rendered element, so these stay plain `.ts` and the consuming component
 * picks the size. Dashboard pages use @tabler/icons-react rather than lucide.
 */

/** Shortcut card on the help page. `href` must be a route that exists. */
export interface QuickHelpLink {
  icon: TablerIcon;
  title: string;
  description: string;
  href: string;
}

export type FaqCategory = "Using MIDAS" | "Understanding results" | "Data & access";

export interface Faq {
  question: string;
  answer: string;
  category: FaqCategory;
}

/**
 * Row in the support / resources rail.
 *
 * `href` is required: every one of these used to be a `<Button>` with no
 * handler and no link, so the whole rail was decorative.
 */
export interface HelpAction {
  icon: TablerIcon;
  label: string;
  href: string;
  /** Short line under the label. */
  description?: string;
  /** Leaves the app. Renders an external-link glyph and target="_blank". */
  external?: boolean;
}

/**
 * Real account security posture, from Clerk. See services/security.server.ts.
 *
 * Replaced `SecurityStat` / `ActiveSession`, which backed a hardcoded list
 * claiming 2FA was enabled and inventing three sessions. Nulls here mean Clerk
 * did not supply the field; render "Unknown", never a plausible placeholder.
 */
export interface SecuritySession {
  id: string;
  /** e.g. "desktop · Chrome". null when Clerk reported no activity detail. */
  device: string | null;
  /** e.g. "Austin, US", resolved by Clerk from IP. null when unavailable. */
  location: string | null;
  lastActiveAt: string;
  current: boolean;
}

export interface SecurityOverview {
  twoFactorEnabled: boolean;
  passwordEnabled: boolean;
  sessions: SecuritySession[];
}

export interface NotificationToggle {
  id: string;
  label: string;
  description?: string;
  icon?: TablerIcon;
  defaultChecked: boolean;
}

export interface NotificationGroup {
  title: string;
  toggles: NotificationToggle[];
}

/** Sidebar link. Consumed by `NavMain` / `NavSecondary`. */
export interface NavItem {
  title: string;
  url: string;
  icon: TablerIcon;
}

/* --- Dashboard overview (server-fetched, see services/dashboard.server.ts) --- */

export interface RecentActivityItem {
  id: string;
  kind: "analysis" | "report";
  title: string;
  status: string;
  /** Only analyses carry a risk level. */
  risk: string | null;
  timestamp: string | null;
  href: string;
}

export interface DashboardOverview {
  totalAnalyses: number;
  /** Last 7 days. */
  recentAnalyses: number;
  totalReports: number;
  /** Analyses + reports still queued or processing. */
  pendingWork: number;
  /** Mean model confidence, 0-1. `null` when nothing has completed yet. */
  avgConfidence: number | null;
  activity: RecentActivityItem[];
}

/**
 * Result of an actual reachability check against a dependency.
 *
 * The only service-status shape there is. A `ServiceStatus` placeholder type
 * used to sit above this one, backing a hardcoded list on the help page;
 * both are gone. `unknown` means we could not determine the state — it is
 * never reported as healthy on a guess.
 */
export interface ServiceProbe {
  service: string;
  status: "operational" | "degraded" | "offline" | "unknown";
  detail: string;
}

/**
 * `indeterminate` means the model's probability distribution did not support
 * any tier — the backend returns it rather than guessing (see
 * `resolve_risk_level` in backend/app/models/cnn_architecture.py). Treat it as
 * "needs a clinician", never as a synonym for low. Historical rows predate it.
 */
export type RiskLevel = "low" | "medium" | "high" | "indeterminate";

/* --- Analysis records (server-fetched, see services/analysis.server.ts) --- */

/**
 * A normalized `medical_analyses` row.
 *
 * Field names match what the retired `AnalyticsContext` produced, so the
 * history/reports mappers below are the originals moved rather than rewritten.
 * `analysis_date` is the row's `created_at`.
 */
export interface AnalysisRecord {
  id: string;
  user_id: string;
  image_name: string;
  image_url: string;
  confidence: number;
  diagnosis: string;
  risk_level: RiskLevel;
  recommendations: string[];
  analysis_date: string;
  processing_time: number;
  /**
   * Clinical review state (feature 002). `null` means the row predates clinical
   * review and is NOT "awaiting review" — treating it as a member would drop
   * every historical analysis into a live clinician queue (FR-044).
   */
  review_state: string | null;
  /** Did the model run? `'failed'` is half of "no usable result" (T043). */
  status: string | null;
}

/** Row shape rendered by the history console. */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  diagnosis: string;
  confidence: number;
  risk_level: RiskLevel;
  /** Seconds. */
  analysisTime: number;
  imageUrl: string;
  imageName: string;
  imageSize: string;
  notes?: string;
  /** `null` on every analysis that predates clinical review. Renders nothing (G3). */
  review_state: string | null;
  /** Did the model run? `'failed'` is half of "no usable result" (T043). */
  status: string | null;
}

/** Row shape rendered by the reports console. */
export interface ReportRow {
  id: string;
  shortId: string;
  date: string;
  diagnosis: string;
  confidence: number;
  risk_level: RiskLevel;
  status: "completed" | "pending" | "reviewed";
  imageUrl: string;
  /** Seconds. */
  analysisTime: number;
  imageSize: string;
  notes?: string;
  hasGeneratedReport?: boolean;
  reportUrl?: string;
  reportGenerationStatus?: "not_generated" | "generating" | "completed" | "failed";
}

/** Live result returned by `POST /api/analysis/analyze`. */
export interface AnalysisResult {
  confidence: number;
  diagnosis: string;
  risk_level: RiskLevel;
  recommendations: string[];
  heatmap_url?: string | null;
  classification_metrics?: {
    confidence?: number;
    top2_gap?: number;
    entropy?: number;
  } | null;
  class_probabilities?: Record<string, number> | null;
  processing_time?: number;
}

/** Preloaded lesion image offered to patients on the analysis page. */
export interface SampleImage {
  id: number;
  name: string;
  url: string;
  description: string;
}

/* --- Documents (server-fetched, see services/documents.server.ts) --- */

export interface DocumentRow {
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  lesionClass?: string | null;
}

/* --- Admin (server-fetched, see services/admin.server.ts) --- */

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  createdAt: number;
  lastSignInAt: number | null;
  imageUrl: string;
}

export interface UserSession {
  id: string;
  device: string | null;
  location: string | null;
  lastActiveAt: string;
}

// FR-USR-2: access facts for the user detail view. Extends ManagedUser with
// the fields Clerk exposes but the directory list doesn't need.
export interface UserDetail extends ManagedUser {
  banned: boolean;
  locked: boolean;
  twoFactorEnabled: boolean;
  passwordEnabled: boolean;
  sessions: UserSession[];
  /**
   * FR-USR-2's "recent audit activity". `[]` (never fabricated) when the
   * caller didn't pass an actor to `getUserDetail` -- audit_events requires
   * an authenticated operator identity to read, so this is genuinely absent
   * rather than empty in that case; the page renders the two states
   * identically today (no rows), but the type keeps the distinction visible
   * in code.
   */
  auditActivity: AuditEvent[];
}

/* --- Admin Control Room (003-admin-control-room, backend/app/api/admin.py) ---
 * Every field typed `| null` here mirrors a real "—" the backend returns
 * on purpose (no upstream metrics source yet, OQ7) -- never fabricate a
 * fallback value for one of these, render the dash. */

export interface OverviewTiles {
  services_operational: string | null;
  open_incidents: number | null;
  abstention_rate_24h: number | null;
  p95_latency_ms: number | null;
}

export interface OverviewResponse {
  tiles: OverviewTiles;
  p95_target_ms: number;
}

/** "unknown" is deliberate -- Constitution Principle II's vocabulary for
 * "cannot currently measure this", never guessed as "operational". */
export type ServiceStatus = "operational" | "degraded" | "unknown";

export interface ServiceHealthRow {
  id: string;
  name: string;
  status: ServiceStatus;
  p50_ms: number | null;
  p95_ms: number | null;
  throughput_rps: number | null;
  error_rate: number | null;
}

export interface HealthServicesResponse {
  services: ServiceHealthRow[];
  p95_target_ms: number;
  p95_latency_ms: number | null;
}

export interface ServiceHealthDetail {
  id: string;
  status: ServiceStatus;
  series_24h: Array<{ t: string; p95_ms: number }>;
  target_ms: number;
  recent_events: Array<{ id: string; label: string; at: string }>;
}

/** One `documents` row, as the RAG ingestion queue renders it (FR-RAG-1,
 * base half -- 4 states only, R6). */
export interface AdminDocumentRow {
  id: string;
  title: string | null;
  file_name: string | null;
  status: "pending" | "processing" | "processed" | "failed";
  source: string | null;
  lesion_class: string | null;
  created_at: string;
  updated_at: string;
}

export interface RagIndexHealth {
  chunk_count: number;
  embedding_models: string[];
  approved_sources: number;
  last_rebuild_at: string | null;
  stale_sources: number | null;
  pending_approvals: number | null;
}

/** `audit_events` row (FR-AUD-1/2). `pending` is an internal reconciliation
 * state (data-model.md §3) -- present in the type because a stuck row is a
 * real, visible thing the Audit view must be able to render, never hidden. */
export interface AuditEvent {
  id: string;
  corr_id: string | null;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  outcome: "allowed" | "refused" | "pending";
  created_at: string;
}

export interface AuditListResponse {
  items: AuditEvent[];
  next_cursor: string | null;
  result_count: number;
}

/** `policy_block_events` row (FR-AUD-4). No actor, no query text, by
 * construction -- the guardrail's own block-site write, not an operator
 * action. */
export interface PolicyBlockEvent {
  id: string;
  corr_id: string | null;
  subject_role: "patient" | "clinician";
  classification: string;
  escalated_to_review: boolean;
  created_at: string;
}

export interface PolicyBlockListResponse {
  items: PolicyBlockEvent[];
  next_cursor: string | null;
  result_count: number;
}

export interface PolicyBlockSummary {
  recent_count_24h: number;
  escalated_and_unreviewed_count: number;
  as_of: string;
}


/* --- Settings page select options --- */

export interface SelectOption {
  value: string;
  label: string;
}
