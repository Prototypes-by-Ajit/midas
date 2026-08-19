import { NextResponse } from "next/server"

import { failureCode, failureResponse, unauthenticated } from "@/lib/clinical/responses"
import { logAllowed, logRefusal } from "@/lib/clinical/audit"
import {
  getCaseForClinician,
  getCaseForPatient,
  getCaseOperational,
  getCaseReviews,
  getCaseVersions,
  type CaseReviewRow,
  type CaseRow,
  type ReportVersionRow,
} from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

/**
 * One case, three renderings (contract §3, FR-040).
 *
 * THE PROJECTION IS CHOSEN FROM `getSessionUser()`, NEVER FROM A REQUEST
 * PARAMETER. There is no `?view=` and no role in the body; a caller who could
 * name their own projection would have named the authority model too (FR-032).
 *
 * There is no 403 on this route at all, and that is the design. Every refusal a
 * *resource* can produce — the case does not exist, the case is not yours, the
 * case is held by another clinician — answers 404 with the same body, so a caller
 * cannot enumerate which ids exist or who is working them (FR-031). A 403 here
 * would answer "it exists, but not for you", which is the leak. T017 and T021
 * each assert the two responses are equal, not merely both 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const session = await getSessionUser()
    if (!session) {
      logRefusal("anonymous", "none", "case.read", id, "UNAUTHENTICATED")
      return unauthenticated()
    }

    // The role is passed down only so each projection can log which one ran. It
    // is never re-derived, and never read from the request (FR-032).
    if (session.role === "clinician") return clinicianView(id, session.userId)
    if (session.role === "admin") return operationalView(id, session.userId)
    return patientView(id, session.userId)
  } catch (error) {
    console.error("Clinical case route error:", error)
    return failureResponse("unavailable", "case")
  }
}

const noStore = { headers: { "Cache-Control": "no-store" } }

// --------------------------------------------------------------------------- //
// Patient
// --------------------------------------------------------------------------- //

/**
 * The patient's own case. No image, no diagnosis, no confidence, and **no
 * version that has not been released**.
 *
 * `released_at` is the gate, not `signed_at` (FR-026). An implementation that
 * filters on signature passes the unsigned case and fails the signed-unreleased
 * one, which is the half T018 exists to catch.
 *
 * A withheld version is **absent**, not null. A null `content` key still tells
 * the patient a document exists and still serialises into the page, so the whole
 * `released_version` object is omitted rather than emptied.
 */
async function patientView(id: string, userId: string) {
  const found = await getCaseForPatient(id, userId)
  if (!found.ok) {
    logRefusal(userId, "patient", "case.read", id, failureCode(found.reason, "case"))
    return failureResponse(found.reason, "case")
  }

  const versions = await getCaseVersions(id, true)
  if (!versions.ok) return failureResponse(versions.reason, "case")

  const released = versions.data
    .filter((v) => v.released_at !== null)
    .sort((a, b) => b.version_number - a.version_number)[0]

  const reviews = await getCaseReviews(id, true)
  if (!reviews.ok) return failureResponse(reviews.reason, "case")

  logAllowed(userId, "patient", "case.read", id)

  return NextResponse.json(
    {
      id: found.data.id,
      review_state: found.data.review_state,
      created_at: found.data.created_at,
      ...(released ? { released_version: releasedVersion(released, versions.data) } : {}),
      // FR-029: a correction is under way on the version the patient can read.
      // The version itself stays readable throughout — there is no interval in
      // which they see nothing (SC-012).
      under_revision: Boolean(released?.correction_started_at),
      ...requestedAction(found.data.review_state, reviews.data),
    },
    noStore,
  )
}

/** The released version, and the id of whatever superseded it if anything has. */
function releasedVersion(released: ReportVersionRow, all: ReportVersionRow[]) {
  const successor = all.find((v) => v.supersedes === released.id)
  return {
    version_number: released.version_number,
    content: released.content,
    released_at: released.released_at,
    ...(successor ? { superseded_by: successor.version_number } : {}),
  }
}

/**
 * FR-006: what the patient has been asked for, in the clinician's own words.
 *
 * Only while the case is actually waiting on them. `case_reviews` is append-only,
 * so an old `more_data_requested` note survives forever — surfacing it after the
 * case moved on would ask a second time for something already supplied.
 */
function requestedAction(state: CaseRow["review_state"], reviews: CaseReviewRow[]) {
  if (state !== "more_data_requested") return {}
  const asked = reviews.find((r) => r.outcome === "more_data_requested")
  return asked?.note ? { requested_action: asked.note } : {}
}

// --------------------------------------------------------------------------- //
// Clinician
// --------------------------------------------------------------------------- //

/**
 * The case as the reviewing clinician sees it: the evidence, every decision, and
 * every version.
 *
 * `confidence` crosses the boundary as a number under `evidence`, deliberately
 * named as the model's output. FR-050 governs how it is *rendered* — never as a
 * finding — and that is the presentation layer's row, not this one's. Withholding
 * it here would leave the clinician reviewing a model they cannot see.
 *
 * `detected_features` is absent because `report_generator.py` already excludes
 * it: it holds pipeline placeholders, not measurements.
 */
async function clinicianView(id: string, userId: string) {
  const found = await getCaseForClinician(id, userId)
  if (!found.ok) {
    logRefusal(userId, "clinician", "case.read", id, failureCode(found.reason, "case"))
    return failureResponse(found.reason, "case")
  }

  const [reviews, versions] = await Promise.all([
    getCaseReviews(id, true),
    getCaseVersions(id, true),
  ])
  if (!reviews.ok) return failureResponse(reviews.reason, "case")
  if (!versions.ok) return failureResponse(versions.reason, "case")

  logAllowed(userId, "clinician", "case.read", id)

  const row = found.data
  return NextResponse.json(
    {
      id: row.id,
      review_state: row.review_state,
      created_at: row.created_at,
      claimed_by: row.claimed_by ?? null,
      claimed_at: row.claimed_at ?? null,
      evidence: {
        image_url: row.image_url ?? null,
        image_name: row.image_name ?? null,
        status: row.status ?? null,
        diagnosis: row.diagnosis ?? null,
        confidence: row.confidence ?? null,
        risk_level: row.risk_level ?? null,
        classification_metrics: row.classification_metrics ?? null,
        processing_time: row.processing_time ?? null,
        error_message: row.error_message ?? null,
      },
      reviews: reviews.data,
      versions: versions.data,
    },
    noStore,
  )
}

// --------------------------------------------------------------------------- //
// Admin
// --------------------------------------------------------------------------- //

/**
 * Operational facts and attribution. **No clinical content of any kind** — no
 * image, no diagnosis, no confidence, no risk level, no report content, and not
 * the clinician's note either (FR-062, spec A9).
 *
 * An admin needs to answer "is this case stuck, and who has it", which none of
 * the withheld fields helps with. `getCaseOperational` is the one service
 * function with no user predicate, because admin authority is not
 * ownership-scoped — which is exactly why its column list is explicit and why
 * this projection is assembled field by field rather than spread.
 */
async function operationalView(id: string, userId: string) {
  const found = await getCaseOperational(id)
  if (!found.ok) {
    logRefusal(userId, "admin", "case.read", id, failureCode(found.reason, "case"))
    return failureResponse(found.reason, "case")
  }

  const [reviews, versions] = await Promise.all([
    getCaseReviews(id, false),
    getCaseVersions(id, false),
  ])
  if (!reviews.ok) return failureResponse(reviews.reason, "case")
  if (!versions.ok) return failureResponse(versions.reason, "case")

  logAllowed(userId, "admin", "case.read", id)

  const row = found.data
  return NextResponse.json(
    {
      id: row.id,
      exists: true,
      review_state: row.review_state,
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
      processing_time: row.processing_time ?? null,
      status: row.status ?? null,
      error_message: row.error_message ?? null,
      attribution: {
        claimed_by: row.claimed_by ?? null,
        claimed_at: row.claimed_at ?? null,
        decisions: reviews.data.map((r) => ({
          clinician_id: r.clinician_id,
          outcome: r.outcome,
          created_at: r.created_at,
        })),
        signatures: versions.data
          .filter((v) => v.signed_at !== null)
          .map((v) => ({
            signed_by: v.signed_by,
            signed_at: v.signed_at,
            version_number: v.version_number,
          })),
        releases: versions.data
          .filter((v) => v.released_at !== null)
          .map((v) => ({
            released_by: v.released_by,
            released_at: v.released_at,
            version_number: v.version_number,
          })),
      },
    },
    noStore,
  )
}
