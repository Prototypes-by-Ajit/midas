import { IconDeviceDesktop, IconMail, IconPhone } from "@tabler/icons-react";
import type { NotificationGroup } from "@/types/dashboard";

/**
 * The nine preference toggles, previously nine near-identical JSX blocks.
 *
 * NOTE: the Switches are uncontrolled (`defaultChecked`) and "Save Preferences"
 * has no handler, so nothing persists today. Preserved as-is by this refactor.
 */
export const NOTIFICATION_GROUPS: NotificationGroup[] = [
  {
    title: "Analysis & Reports",
    toggles: [
      {
        id: "analysis-complete",
        label: "Analysis Complete",
        description: "Get notified when your AI analysis is completed",
        defaultChecked: true,
      },
      {
        id: "high-risk",
        label: "High-Risk Detection",
        description: "Immediate alerts for high-risk lesions detected",
        defaultChecked: true,
      },
      {
        id: "report-ready",
        label: "Report Generation",
        description: "Notify when detailed reports are generated",
        defaultChecked: true,
      },
    ],
  },
  {
    title: "System & Account",
    toggles: [
      {
        id: "system-updates",
        label: "System Updates",
        description: "Important system updates and maintenance alerts",
        defaultChecked: true,
      },
      {
        id: "security-alerts",
        label: "Security Alerts",
        description: "Login alerts and security-related notifications",
        defaultChecked: true,
      },
      {
        id: "usage-summary",
        label: "Usage Summary",
        description: "Weekly summary of your MIDAS usage and statistics",
        defaultChecked: false,
      },
    ],
  },
];

/** Delivery methods render inline with an icon and no description. */
export const NOTIFICATION_DELIVERY: NotificationGroup = {
  title: "Delivery Methods",
  toggles: [
    { id: "in-app", label: "In-App Notifications", icon: IconDeviceDesktop, defaultChecked: true },
    { id: "email", label: "Email Notifications", icon: IconMail, defaultChecked: true },
    { id: "sms", label: "SMS Notifications", icon: IconPhone, defaultChecked: false },
  ],
};
