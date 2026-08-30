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
}

/* --- Settings page select options --- */

export interface SelectOption {
  value: string;
  label: string;
}
