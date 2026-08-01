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
