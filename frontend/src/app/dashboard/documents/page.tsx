import type { Metadata } from "next"
// `dynamic` is aliased because this file also exports the `dynamic` route
// segment config below — the two names collide at module scope.
import nextDynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/services/auth.server"
import { getDocuments } from "@/services/documents.server"

const DocumentsConsole = nextDynamic(
  () => import("@/comps/dashboard/documents/documents-console")
)

export const metadata: Metadata = {
  title: "Documents",
  description: "Upload and manage the clinician knowledge base.",
}

export const dynamic = "force-dynamic"

/**
 * Server Component. The role gate runs here, so a patient's HTML contains the
 * access-denied card and never the document table — the previous client gate
 * shipped both and chose between them after hydration.
 */
export default async function DocumentsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  // Matches the previous client gate exactly: clinician only, not admin.
  const isClinician = session.role === "clinician"
  const result = isClinician ? await getDocuments() : null

  return (
    <DocumentsConsole
      documents={result?.ok ? result.data : []}
      isClinician={isClinician}
    />
  )
}
