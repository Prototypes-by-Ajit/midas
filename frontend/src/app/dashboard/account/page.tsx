import type { Metadata } from "next"
import dynamic from "next/dynamic"

const AccountConsole = dynamic(() => import("@/comps/dashboard/account/account-console"))

export const metadata: Metadata = {
  title: "Account",
  description: "Your profile details and account information.",
}

/**
 * Server Component. The console reads and writes the Clerk profile entirely in
 * the browser, so there is nothing to fetch here — this route exists to own the
 * metadata and keep the client boundary at the island.
 */
export default function AccountPage() {
  return <AccountConsole />
}
