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
 * `/dashboard/users/permissions` (speckit-implement finding, 2026-08-30, T022):
 * data-model.md §6's nav-array code omitted a "Roles & Permissions" entry
 * entirely, but quickstart.md's own "Navigation structure by role" table lists
 * one for all three roles (7/4/5 entries respectively) — the two design
 * documents disagreed, and T022's own Done-when clause names quickstart.md's
 * table as the one to match. FR-USR-6 requires the matrix be reachable by ML
 * Engineer and SRE, neither of whom has "Users" in their nav at all, so it
 * cannot be folded into the Admin-only `/dashboard/users` directory page (T034
 * refuses that endpoint for both roles) — it needs its own route, unauthenticated
 * against the directory fetch entirely. Nested under `/dashboard/users/*`
 * (R2's "extended in place" family) rather than under `/dashboard/admin/*`,
 * since it isn't gated the way the rest of Users & Roles is (FR-USR-6). Page
 * component: T073 (Phase 10, alongside T055).
 */
const PERMISSIONS_NAV_ITEM: NavItem = {
  title: "Roles & Permissions",
  url: "/dashboard/users/permissions",
  icon: IconShieldCheck,
};

/** Appended for admins only. */
export const ADMIN_NAV: NavItem[] = [
  { title: "Operations", url: "/dashboard/operations", icon: IconActivity },
  { title: "Users", url: "/dashboard/users", icon: IconUsers },
  { title: "Overview", url: "/dashboard/admin/overview", icon: IconLayoutDashboard },
  { title: "System Health", url: "/dashboard/admin/health", icon: IconActivity },
  { title: "RAG Operations", url: "/dashboard/admin/rag", icon: IconDatabase },
  { title: "Audit & Incidents", url: "/dashboard/admin/audit", icon: IconShieldCheck },
  PERMISSIONS_NAV_ITEM,
];

/**
 * Appended for ML Engineers only (FR-USR-6). No Users & Roles, no Audit
 * access — per the §21 permissions matrix, both are "—" for this role in this
 * MVP. Roles & Permissions IS included — it's reachable by every operator
 * role independent of the Users & Roles gate (FR-USR-6).
 */
export const ML_ENGINEER_NAV: NavItem[] = [
  { title: "Overview", url: "/dashboard/admin/overview", icon: IconLayoutDashboard },
  { title: "System Health", url: "/dashboard/admin/health", icon: IconActivity },
  { title: "RAG Operations", url: "/dashboard/admin/rag", icon: IconDatabase },
  PERMISSIONS_NAV_ITEM,
];

/**
 * Appended for SREs only (FR-USR-6). Audit access, but no Users & Roles — per
 * the §21 permissions matrix.
 */
export const SRE_NAV: NavItem[] = [
  { title: "Overview", url: "/dashboard/admin/overview", icon: IconLayoutDashboard },
  { title: "System Health", url: "/dashboard/admin/health", icon: IconActivity },
  { title: "RAG Operations", url: "/dashboard/admin/rag", icon: IconDatabase },
  { title: "Audit & Incidents", url: "/dashboard/admin/audit", icon: IconShieldCheck },
  PERMISSIONS_NAV_ITEM,
];

/** Pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { title: "Help", url: "/dashboard/help", icon: IconHelp },
];
