import {
  IconActivity,
  IconDashboard,
  IconFileAnalytics,
  IconFolderOpen,
  IconHelp,
  IconHistory,
  IconInbox,
  IconRobot,
  IconScanEye,
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

/** Appended for admins only. */
export const ADMIN_NAV: NavItem[] = [
  { title: "Operations", url: "/dashboard/operations", icon: IconActivity },
  { title: "Users", url: "/dashboard/users", icon: IconUsers },
];

/** Pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { title: "Help", url: "/dashboard/help", icon: IconHelp },
];
