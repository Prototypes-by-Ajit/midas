import type { Metadata } from "next"
import dynamic from "next/dynamic"

const SettingsConsole = dynamic(() => import("@/comps/dashboard/settings/settings-console"))

export const metadata: Metadata = {
  title: "Settings",
  description: "Profile, notification, security and display preferences.",
}

/**
 * Server Component. Every setting the console owns lives in Clerk or in
 * localStorage, so there is nothing to read here.
 */
export default function SettingsPage() {
  return <SettingsConsole />
}
