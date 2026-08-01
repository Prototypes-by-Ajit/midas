import { IconDeviceDesktop, IconFingerprint, IconShield } from "@tabler/icons-react";
import type { ActiveSession, SecurityStat } from "@/types/dashboard";

/**
 * NOTE: these values are hard-coded placeholders, not live account state.
 * The page presents them as real security posture (2FA status, session list).
 * Wiring them to Clerk is a product decision — see the handover notes.
 */
export const SECURITY_STATS: SecurityStat[] = [
  {
    title: "Account Status",
    icon: IconShield,
    iconClass: "text-green-600",
    value: "Secure",
    valueClass: "text-green-600",
    badge: "All checks passed",
  },
  {
    title: "Two-Factor Auth",
    icon: IconFingerprint,
    iconClass: "text-blue-600",
    value: "Enabled",
    note: "SMS & App based",
  },
  {
    title: "Active Sessions",
    icon: IconDeviceDesktop,
    iconClass: "text-orange-600",
    value: "3",
    note: "Devices logged in",
  },
];

export const ACTIVE_SESSIONS: ActiveSession[] = [
  { device: "MacBook Pro", location: "New York, US", current: true, lastSeen: "Active now" },
  { device: "iPhone 15", location: "New York, US", current: false, lastSeen: "2 hours ago" },
  { device: "Chrome Browser", location: "California, US", current: false, lastSeen: "1 day ago" },
];
