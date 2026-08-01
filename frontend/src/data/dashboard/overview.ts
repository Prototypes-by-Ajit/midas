import {
  IconFileAnalytics,
  IconFolderOpen,
  IconHistory,
  IconRobot,
  IconUsers,
} from "@tabler/icons-react";
import type { NavItem } from "@/types/dashboard";

/**
 * Secondary destinations on the overview. Deliberately NOT equal in weight to
 * "Start new analysis" — these are quiet text links, that is the page's one
 * dominant action.
 */
export const OVERVIEW_SHORTCUTS: (NavItem & { description: string })[] = [
  {
    title: "AI Assistant",
    url: "/dashboard/assistant",
    icon: IconRobot,
    description: "Ask dermatology questions against the indexed literature",
  },
  {
    title: "Reports",
    url: "/dashboard/reports",
    icon: IconFileAnalytics,
    description: "Generate and download clinical reports",
  },
  {
    title: "History",
    url: "/dashboard/history",
    icon: IconHistory,
    description: "Review every past analysis",
  },
];

/** Appended only for clinicians. */
export const CLINICIAN_SHORTCUT: NavItem & { description: string } = {
  title: "Documents",
  url: "/dashboard/documents",
  icon: IconFolderOpen,
  description: "Manage the indexed knowledge base",
};

/** Appended only for admins. Never rendered for any other role. */
export const ADMIN_SHORTCUT: NavItem & { description: string } = {
  title: "User management",
  url: "/dashboard/users",
  icon: IconUsers,
  description: "Review accounts and assign roles",
};
