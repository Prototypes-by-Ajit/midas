import { NextResponse } from "next/server"

import { errorBody } from "@/lib/reports/contract"
import type { ClinicalFailure } from "@/services/clinical.server"

/**
 * Contract §2's status table, in one place.
 *
 * Six handlers share it because six handlers that each map their own failures
 * are six handlers that can disagree — and the disagreement that matters here is
 * 403 vs 404. 403 answers "you may not do this action" and reveals nothing about
 * a resource. 404 answers every resource question — absent, or not yours —
 * identically, so a caller cannot enumerate (FR-031). A handler returning 403 for
 * a foreign resource id is a defect, and keeping the mapping here is what stops
 * one from drifting in.
 *
 * `errorBody()` comes from the report contract rather than a second envelope of
 * this slice's own. One error shape for the application (contract §6).
 */

/** Which noun a 404 names. The two never share a code — contract §2. */
export type ClinicalResource = "case" | "version"

export const unauthenticated = () =>
  NextResponse.json(
    errorBody("UNAUTHENTICATED", "You need to be signed in."),
    { status: 401 },
  )

/**
 * Wrong role for the action.
 *
 * The message names no resource, because at the point this fires the handler has
 * not looked one up — and must not. A refusal that reports on the resource is a
 * refusal that has already read it.
 */
export const forbidden = (message = "You do not have permission to do this.") =>
  NextResponse.json(errorBody("FORBIDDEN", message), { status: 403 })

/**
 * Every failure the service can report, as the status contract §2 assigns it.
 *
 * `document_missing` is not in §2's published table. E4 requires the release path
 * to refuse when the stored object is absent and says only that the refusal must
 * state a reason; 409 puts it beside `NOT_SIGNED`, which is the same kind of
 * fact — the version is not releasable *yet*. Flagged for the contract's next
 * revision rather than invented silently.
 */
export function failureResponse(
  reason: ClinicalFailure,
  resource: ClinicalResource,
): NextResponse {
  const notFoundCode = failureCode(reason, resource)

  switch (reason) {
    case "not_found":
      // Deliberately identical for "no such id" and "not yours" (FR-031). The
      // wording says nothing either, or the status would be the only thing that
      // did not leak.
      return NextResponse.json(
        errorBody(notFoundCode, resource === "case" ? "No such case." : "No such report version."),
        { status: 404 },
      )

    case "already_claimed":
      return NextResponse.json(
        errorBody("ALREADY_CLAIMED", "Another clinician is already reviewing this case."),
        { status: 409 },
      )

    case "already_signed":
      return NextResponse.json(
        errorBody(
          "ALREADY_SIGNED",
          "This version is already signed. A correction is signed as a new version.",
        ),
        { status: 409 },
      )

    case "not_signed":
      return NextResponse.json(
        errorBody("NOT_SIGNED", "A version has to be signed before it can be released."),
        { status: 409 },
      )

    case "document_missing":
      return NextResponse.json(
        errorBody(
          "DOCUMENT_MISSING",
          "The document for this version is not in storage, so it cannot be released.",
        ),
        { status: 409 },
      )

    case "invalid_transition":
      return NextResponse.json(
        errorBody("INVALID_TRANSITION", "This case is not in a state that allows that."),
        { status: 422 },
      )

    case "unavailable":
      return NextResponse.json(
        errorBody("SERVICE_UNAVAILABLE", "Case records could not be read just now."),
        { status: 503 },
      )
  }
}

/**
 * The machine code alone, without building a response.
 *
 * T031's audit line records the code rather than the message, because the codes
 * are a closed set and the messages are user-facing copy that will be reworded.
 * A log that stores copy goes stale the first time someone edits a sentence.
 */
export function failureCode(reason: ClinicalFailure, resource: ClinicalResource): string {
  switch (reason) {
    case "not_found":
      return resource === "case" ? "CASE_NOT_FOUND" : "VERSION_NOT_FOUND"
    case "already_claimed":
      return "ALREADY_CLAIMED"
    case "already_signed":
      return "ALREADY_SIGNED"
    case "not_signed":
      return "NOT_SIGNED"
    case "document_missing":
      return "DOCUMENT_MISSING"
    case "invalid_transition":
      return "INVALID_TRANSITION"
    case "unavailable":
      return "SERVICE_UNAVAILABLE"
  }
}
