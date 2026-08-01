import {
  IconDashboard,
  IconFileAnalytics,
  IconFolderOpen,
  IconHelp,
  IconHistory,
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
  { title: "Documents", url: "/dashboard/documents", icon: IconFolderOpen },
];

/** Appended for admins only. */
export const ADMIN_NAV: NavItem[] = [
  { title: "Users", url: "/dashboard/users", icon: IconUsers },
];

/** Pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { title: "Help", url: "/dashboard/help", icon: IconHelp },
];
