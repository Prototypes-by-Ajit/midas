import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { DocumentRow } from "@/types/dashboard"

/**
 * Server-side read of the clinician document library.
 *
 * Ported from `GET /api/documents`, including the fact that it is deliberately
 * NOT scoped by `user_id` — this is a shared library every clinician sees, and
 * the filter is on `storage_path` (rows without one were never uploaded as
 * files). Access control is the caller's job: the page gates on the role from
 * `getSessionUser()`, and the route handler keeps its own `clerkClient` check
 * for the upload/delete paths.
 */
export async function getDocuments(): Promise<
  { ok: true; data: DocumentRow[] } | { ok: false }
> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }

  try {
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, file_name, file_size, uploaded_by, created_at, status, lesion_class, storage_path"
      )
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false })

    if (error) return { ok: false }

    return {
      ok: true,
      data: (data ?? []).map((doc) => ({
        id: doc.id,
        name: doc.file_name || "Unnamed document",
        size: doc.file_size || 0,
        uploadedBy: doc.uploaded_by || "Unknown",
        uploadedAt: doc.created_at,
        status: doc.status || "pending",
        lesionClass: doc.lesion_class,
      })),
    }
  } catch {
    return { ok: false }
  }
}
