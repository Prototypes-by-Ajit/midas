import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getSecurityOverview } from "@/services/security.server"

const SecurityConsole = nextDynamic(() =>
  import("@/comps/dashboard/security/security-console").then((m) => m.SecurityConsole)
)

export const metadata: Metadata = {
  title: "Security & Privacy",
  description: "Your account protection and active sessions.",
}

/**
 * Per-account session data — must never be served from a shared cache.
 * `auth()` already forces dynamic rendering; this states the requirement so a
 * later `revalidate` cannot quietly make one user's sessions cacheable.
 */
export const dynamic = "force-dynamic"

/** Server Component. Clerk is read here, so the panel is populated in the first HTML. */
export default async function SecurityPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  const result = await getSecurityOverview()

  return (
    <SecurityConsole
      overview={result.ok ? result.data : null}
      loadFailed={!result.ok}
    />
  )
}
