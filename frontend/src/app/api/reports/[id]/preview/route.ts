import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { errorBody } from "@/lib/reports/contract"
import { assertReportOwner } from "@/services/reports.server"

/**
 * Preview a stored report. Owner-scoped, read-only, and it never regenerates.
 *
 * Replaces the browser's own `createSignedUrl('report_storage', …)` calls, which
 * ran from an anon-key client with no ownership check of any kind.
 *
 * Signs on every call rather than returning a stored link. A signed URL minted at
 * generation time expires an hour later, and after that the report is stored,
 * intact, and unreachable — the person is told their report is ready and then
 * shown nothing (FR-037). Re-signing costs one round trip and removes the failure
 * mode entirely.
 *
 * `degraded` is served alongside `completed` deliberately. An incomplete report
 * exists, is stored, and is useful; refusing to show it would hide the very
 * document whose limitations the interface is trying to disclose (FR-017, D20).
 */

/** Ten minutes: long enough to open in a viewer, short enough that a leaked link dies. */
const SIGNED_URL_TTL_SECONDS = 600

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        errorBody("UNAUTHENTICATED", "You need to be signed in to view this report."),
        { status: 401 }
      )
    }

    const owner = await assertReportOwner(id, userId)
    if (!owner.ok) {
      if (owner.reason === "forbidden") {
        return NextResponse.json(
          errorBody("FORBIDDEN", "This report belongs to someone else."),
          { status: 403 }
        )
      }
      if (owner.reason === "unavailable") {
        return NextResponse.json(
          errorBody("INTERNAL", "Your reports could not be read just now."),
          { status: 500 }
        )
      }
      return NextResponse.json(
        errorBody("NOT_FOUND", "That report does not exist."),
        { status: 404 }
      )
    }

    const report = owner.report

    if (report.generation_status !== "completed" && report.generation_status !== "degraded") {
      return NextResponse.json(
        errorBody(
          "NOT_READY",
          report.generation_status === "generating" || report.generation_status === "pending"
            ? "This report is still being generated."
            : "This report was not generated, so there is nothing to preview."
        ),
        { status: 409 }
      )
    }

    if (!report.storage_path) {
      return NextResponse.json(
        errorBody("NOT_FOUND", "This report has no stored document."),
        { status: 404 }
      )
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json(
        errorBody("INTERNAL", "Report storage is not configured."),
        { status: 500 }
      )
    }

    const { data, error } = await supabase.storage
      .from("report_storage")
      .createSignedUrl(report.storage_path, SIGNED_URL_TTL_SECONDS)

    // The row says the document is stored and storage disagrees. Say so, rather
    // than handing back a link that resolves to nothing (FR-040): an empty file
    // reads as a broken report, not as a missing one.
    if (error || !data?.signedUrl) {
      console.error("Preview: stored report is missing from storage", report.id, error)
      return NextResponse.json(
        errorBody("NOT_FOUND", "The stored document for this report could not be found."),
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        report_id: report.id,
        report_number: report.report_number,
        report_type: report.report_type,
        generation_status: report.generation_status,
        preview_url: data.signedUrl,
        expires_in: SIGNED_URL_TTL_SECONDS,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Preview route error:", error)
    return NextResponse.json(
      errorBody("INTERNAL", "Something went wrong loading this report."),
      { status: 500 }
    )
  }
}
