import {
  IconActivity,
  IconDashboard,
  IconDatabase,
  IconFileAnalytics,
  IconFolderOpen,
  IconHelp,
  IconHistory,
  IconInbox,
  IconLayoutDashboard,
  IconRobot,
  IconScanEye,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { NavItem } from "@/types/dashboard";

/** Shown to every signed-in user. */
export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "AI Analysis", url: "/dashboard/analysis", icon: IconScanEye },
  { title: "AI Assistant", url: "/dashboard/assistant", icon: IconRobot },
  { title: "Reports", url: "/dashboard/reports", icon: IconFileAnalytics },
  { title: "History", url: "/dashboard/history", icon: IconHistory },
];

/** Appended for clinicians only. */
export const CLINICIAN_NAV: NavItem[] = [
  { title: "Review queue", url: "/dashboard/queue", icon: IconInbox },
  { title: "Documents", url: "/dashboard/documents", icon: IconFolderOpen },
];

/**
 * The complete sidebar for admins — the sole operator role after the
 * ml_engineer/sre collapse (2026-08-31). Previously three role-scoped arrays
 * (admin/ml_engineer/sre) differentiated by a permissions matrix; that matrix
 * and its "Roles & Permissions" reference page were removed along with the
 * two roles, since one operator role has nothing left to differentiate.
 */
export const ADMIN_NAV: NavItem[] = [
  { title: "Operations", url: "/dashboard/operations", icon: IconActivity },
  { title: "Users", url: "/dashboard/users", icon: IconUsers },
  { title: "Overview", url: "/dashboard/admin/overview", icon: IconLayoutDashboard },
  { title: "System Health", url: "/dashboard/admin/health", icon: IconActivity },
  { title: "RAG Operations", url: "/dashboard/admin/rag", icon: IconDatabase },
  { title: "Audit & Incidents", url: "/dashboard/admin/audit", icon: IconShieldCheck },
];

/** Pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { title: "Help", url: "/dashboard/help", icon: IconHelp },
];
