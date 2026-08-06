import type { TablerIcon } from "@tabler/icons-react";

/**
 * Shapes for the `src/data/dashboard/*` content modules.
 *
 * Same rule as the (home) data modules: `icon` is a component *reference*, never
 * a rendered element, so these stay plain `.ts` and the consuming component
 * picks the size. Dashboard pages use @tabler/icons-react rather than lucide.
 */

/** Card linking to a docs page. */
export interface QuickHelpLink {
  icon: TablerIcon;
  title: string;
  description: string;
  link: string;
}

export interface Faq {
  question: string;
  answer: string;
}

/** Row in the support-channel / resources lists. */
export interface HelpAction {
  icon: TablerIcon;
  label: string;
  /** Optional trailing badge text. Mutually exclusive with `external`. */
  badge?: string;
  /** Show a trailing external-link glyph instead of a badge. */
  external?: boolean;
}

export interface ServiceStatus {
  service: string;
  status: string;
  /** Tailwind text-colour class for the status badge. */
  color: string;
}

/** Summary tile at the top of the security page. */
export interface SecurityStat {
  title: string;
  icon: TablerIcon;
  /** Tailwind colour class for the tile icon. */
  iconClass: string;
  value: string;
  /** Optional colour class for the value text. */
  valueClass?: string;
  /** Rendered as a Badge when present. */
  badge?: string;
  /** Rendered as muted helper text when present. */
  note?: string;
}

export interface ActiveSession {
  device: string;
  location: string;
  current: boolean;
  lastSeen: string;
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
 * Distinct from `ServiceStatus` above, which is the help page's static
 * placeholder list. `unknown` means we could not determine the state — it is
 * never reported as healthy on a guess.
 */
export interface ServiceProbe {
  service: string;
  status: "operational" | "degraded" | "offline" | "unknown";
  detail: string;
}

export type RiskLevel = "low" | "medium" | "high";

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
  detected_features: string[];
  analysis_date: string;
  processing_time: number;
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
  detected_features: string[];
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

/* --- Settings page select options --- */

export interface SelectOption {
  value: string;
  label: string;
}
