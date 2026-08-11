import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { errorBody } from "@/lib/reports/contract"
import { assertReportOwner } from "@/services/reports.server"

/**
 * Download a stored report as PDF bytes. Owner-scoped, read-only.
 *
 * The refusal vocabulary here is deliberately identical to the preview route's:
 * both call `assertReportOwner`, so a foreign report id cannot be a 403 on one
 * route and a 404 on the other. Two routes that each wrote their own check were
 * two routes that could disagree about who owns a document.
 *
 * Three defects are removed here:
 *
 *   1. Env resolution was inlined a third time, accepting only
 *      `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. One valid
 *      configuration — the service role key under its `_ROLE_` spelling — made
 *      generation succeed and every download fail (D6, FR-044). `getSupabaseAdmin`
 *      reads both spellings of both variables.
 *   2. `generation_status !== 'completed'` refused `degraded` reports. An
 *      incomplete report exists, is stored, and is useful; refusing to hand it
 *      over hides the document whose limitations the interface is disclosing
 *      (FR-017, D20).
 *   3. A dormant `report.clinician_id !== userId` branch widened access to a
 *      column no migration creates and nothing populates. Removed rather than
 *      extended: clinician sharing is its own feature, with its own authorization
 *      model, and a half-wired version of it in a download route is the worst
 *      place for that decision to live.
 */

/** Five minutes: long enough for the transfer, short enough that a leaked link dies. */
const SIGNED_URL_TTL_SECONDS = 300

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        errorBody("UNAUTHENTICATED", "You need to be signed in to download this report."),
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
            : "This report was not generated, so there is nothing to download."
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

    const { data: signed, error: signError } = await supabase.storage
      .from("report_storage")
      .createSignedUrl(report.storage_path, SIGNED_URL_TTL_SECONDS, {
        download: `${report.report_number}.pdf`,
      })

    // The row says the document is stored and storage disagrees. Say so, rather
    // than streaming an empty body that reads as a broken report (FR-040).
    if (signError || !signed?.signedUrl) {
      console.error("Download: stored report is missing from storage", report.id, signError)
      return NextResponse.json(
        errorBody("NOT_FOUND", "The stored document for this report could not be found."),
        { status: 404 }
      )
    }

    const pdfResponse = await fetch(signed.signedUrl)
    if (!pdfResponse.ok) {
      console.error("Download: storage refused the signed URL", report.id, pdfResponse.status)
      return NextResponse.json(
        errorBody("INTERNAL", "The report could not be read from storage."),
        { status: 500 }
      )
    }

    const bytes = await pdfResponse.arrayBuffer()

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // The filename the server serves is the report's own number, so the saved
        // file and the number printed inside the document agree (FR-024).
        "Content-Disposition": `attachment; filename="${report.report_number}.pdf"`,
        "Content-Length": bytes.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Download route error:", error)
    return NextResponse.json(
      errorBody("INTERNAL", "Something went wrong downloading this report."),
      { status: 500 }
    )
  }
}
