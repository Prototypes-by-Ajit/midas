import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { makeReportNumber } from "@/lib/reports/contract"
import type { CaseReviewState, ReviewOutcome, VersionState } from "@/lib/clinical/contract"
import { versionDocumentState } from "@/lib/clinical/version-view"
import type {
  DocumentProbe,
  VersionDocumentInput,
  VersionDocumentState,
} from "@/lib/clinical/version-view"

/**
 * Every query the clinical review slice makes, and every scope predicate that
 * guards one.
 *
 * `getSupabaseAdmin()` holds the service-role key, which **bypasses RLS**. The
 * predicates in this file are therefore not a second layer of defence — they are
 * the only one. Migration `015` says so in as many words: the deny-all policies
 * on `report_versions` and `case_reviews` exist to make the refusal explicit,
 * not to enforce it.
 *
 * Contract: `.specify/specs/002-three-view-clinical-pipeline/contracts/
 * clinical-pipeline-contract.md` §5 lists each function and its predicate. They
 * live together in one module so a second handler cannot write a third version
 * of a check that already exists here — the failure TODOS T-1 records, where six
 * handlers each hand-rolled `createClient()`.
 *
 * Functions return result objects rather than throwing, matching
 * `reports.server.ts` and `analysis.server.ts`, so a route renders a contract
 * §2 status instead of falling through to a 500.
 */

// --------------------------------------------------------------------------- //
// Result shape
// --------------------------------------------------------------------------- //

/**
 * Why a call did not succeed. The route maps each to a contract §2 status; the
 * service never decides an HTTP code, so the same reason can carry a different
 * status on a different endpoint without this file knowing.
 *
 * `not_found` covers **both** "no such row" and "not yours" on purpose (FR-031).
 * Anything finer leaks which ids exist, which is the enumeration the 403/404
 * split in contract §2 is written to prevent.
 */
export type ClinicalFailure =
  | "not_found"
  | "already_claimed"
  | "already_signed"
  | "not_signed"
  | "invalid_transition"
  | "document_missing"
  | "unavailable"

export type ClinicalResult<T> = { ok: true; data: T } | { ok: false; reason: ClinicalFailure }

const fail = (reason: ClinicalFailure): { ok: false; reason: ClinicalFailure } => ({
  ok: false,
  reason,
})

// --------------------------------------------------------------------------- //
// Column lists
//
// Explicit everywhere, unlike `reports.server.ts`'s deliberate `select("*")`.
// That file over-fetches a narrow table to survive a mid-rollout schema; this
// one filters clinical content by role, and a star select would leak the moment
// a column is added (contract §3).
// --------------------------------------------------------------------------- //

/** Admin. Operational facts only: no image, no diagnosis, no score, no content. */
const OPERATIONAL_COLUMNS =
  "id, review_state, created_at, updated_at, processing_time, status, error_message, claimed_by, claimed_at"

/**
 * Clinician. The operational columns plus the evidence needed to review.
 *
 * `detected_features` is excluded, as `report_generator.py` already excludes it —
 * it holds pipeline placeholders rather than measurements (Constitution II).
 *
 * `abstained` is excluded because **there is no such column**. Contract §3 names
 * one; `grep -rn "abstain" backend/app frontend/src supabase/migrations` returns
 * nothing, and review note E2 reframed abstention as *no usable result* — which
 * is `status = 'failed'` or a null `diagnosis`, both already in this list.
 */
const CLINICIAN_COLUMNS = `${OPERATIONAL_COLUMNS}, user_id, image_url, image_name, diagnosis, confidence, risk_level, classification_metrics`

/** Patient. Their own case's clinical state and nothing about the inference. */
const PATIENT_COLUMNS = "id, user_id, review_state, created_at"

/** Who signed and released what, and when. No `content`, no digest, no storage path. */
const VERSION_ATTRIBUTION_COLUMNS =
  "id, report_id, version_number, state, supersedes, signed_by, signed_at, released_by, released_at, correction_started_by, correction_started_at, created_at"

const VERSION_COLUMNS = `${VERSION_ATTRIBUTION_COLUMNS}, content, content_digest, storage_path, sign_rationale`

/** Attribution without the note. What was done and by whom is operational; what the clinician wrote is not. */
const REVIEW_ATTRIBUTION_COLUMNS = "id, clinician_id, outcome, created_at"

const REVIEW_COLUMNS = `${REVIEW_ATTRIBUTION_COLUMNS}, note`

const REPORT_STORAGE_BUCKET = "report_storage"

// --------------------------------------------------------------------------- //
// Row types
// --------------------------------------------------------------------------- //

export interface CaseRow {
  id: string
  user_id?: string
  review_state: CaseReviewState | null
  created_at: string
  updated_at?: string | null
  processing_time?: number | null
  status?: string | null
  error_message?: string | null
  claimed_by?: string | null
  claimed_at?: string | null
  image_url?: string | null
  image_name?: string | null
  diagnosis?: string | null
  confidence?: number | null
  risk_level?: string | null
  classification_metrics?: Record<string, unknown> | null
}

export interface ReportVersionRow {
  id: string
  report_id: string
  version_number: number
  content: Record<string, unknown>
  content_digest: string | null
  storage_path: string | null
  state: VersionState
  supersedes: string | null
  signed_by: string | null
  signed_at: string | null
  sign_rationale: string | null
  released_by: string | null
  released_at: string | null
  correction_started_by: string | null
  correction_started_at: string | null
  created_at: string
}

export interface CaseReviewRow {
  id: string
  clinician_id: string
  outcome: ReviewOutcome
  created_at: string
  note?: string
}

/** One row of the work list. `waited_ms` is derived, not stored. */
export interface QueueRow extends CaseRow {
  waited_ms: number
}

// --------------------------------------------------------------------------- //
// 1. getReviewQueue — the work list
// --------------------------------------------------------------------------- //

/**
 * Unclaimed cases plus this clinician's own claimed cases, oldest waiting first.
 *
 * The `review_state is not null` predicate is the one that keeps historical rows
 * out of a live queue (FR-044) — `NULL` means the row predates this feature and
 * is unknown, never "awaiting review". It matches the partial index `015` builds,
 * so the index cannot serve a query that would return them.
 *
 * The `.or()` is the whole of spec A1: a case nobody holds is visible to every
 * clinician, and a case someone holds is visible to that clinician alone.
 */
export async function getReviewQueue(
  userId: string,
  now: Date = new Date(),
): Promise<ClinicalResult<QueueRow[]>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data, error } = await supabase
      .from("medical_analyses")
      .select(CLINICIAN_COLUMNS)
      .not("review_state", "is", null)
      .or(`claimed_by.is.null,claimed_by.eq.${userId}`)
      .order("created_at", { ascending: true })

    if (error) return fail("unavailable")

    const rows = (data ?? []) as unknown as CaseRow[]
    return {
      ok: true,
      data: rows.map((row) => ({
        ...row,
        waited_ms: Math.max(0, now.getTime() - new Date(row.created_at).getTime()),
      })),
    }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 2-4. The three case reads
// --------------------------------------------------------------------------- //

/**
 * The shape copied from `assertReportOwner` (`reports.server.ts:143`): run the
 * scoped read first and return its row; on a miss, probe for existence with the
 * id alone and answer the same way either time.
 *
 * The probe exists so the *caller* can tell 409 from 404 where the contract
 * distinguishes them (claim). For the reads it deliberately changes nothing —
 * both misses are `not_found`, which is FR-031.
 */
async function readCaseScoped(
  columns: string,
  applyScope: (query: ReturnType<ReturnType<typeof buildCaseQuery>>) => unknown,
  id: string,
): Promise<ClinicalResult<CaseRow>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const scoped = applyScope(
      buildCaseQuery(supabase)(columns).eq("id", id),
    ) as PostgrestLike<CaseRow>

    const { data, error } = await scoped.maybeSingle()
    if (error) return fail("unavailable")
    if (data) return { ok: true, data: data as CaseRow }

    return fail("not_found")
  } catch {
    return fail("unavailable")
  }
}

/**
 * The narrow slice of the PostgREST builder this module uses.
 *
 * Written out rather than imported so the scope helpers can be typed without
 * pulling `PostgrestFilterBuilder`'s six generic parameters through every call
 * site. The stub in `lib/clinical/denials.test.ts` implements exactly this
 * surface, which is not a coincidence — a predicate this type cannot express is
 * a predicate that suite cannot check.
 */
interface PostgrestLike<T> {
  eq(column: string, value: unknown): PostgrestLike<T>
  is(column: string, value: unknown): PostgrestLike<T>
  or(expression: string): PostgrestLike<T>
  not(column: string, operator: string, value: unknown): PostgrestLike<T>
  maybeSingle(): Promise<{ data: T | null; error: unknown }>
}

const buildCaseQuery =
  (supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) =>
  (columns: string): PostgrestLike<CaseRow> =>
    supabase.from("medical_analyses").select(columns) as unknown as PostgrestLike<CaseRow>

/**
 * A case a clinician may work: unclaimed, or claimed by this clinician.
 *
 * A case held by someone else answers `not_found`, identically to an id that
 * does not exist (T017). A 403 here, or a message naming the holder, would let a
 * caller enumerate which case ids exist and who is working them.
 */
export function getCaseForClinician(id: string, userId: string): Promise<ClinicalResult<CaseRow>> {
  return readCaseScoped(
    CLINICIAN_COLUMNS,
    (query) => query.or(`claimed_by.is.null,claimed_by.eq.${userId}`),
    id,
  )
}

/** A case the patient owns. Another patient's case answers `not_found` (T021). */
export function getCaseForPatient(id: string, userId: string): Promise<ClinicalResult<CaseRow>> {
  return readCaseScoped(PATIENT_COLUMNS, (query) => query.eq("user_id", userId), id)
}

/**
 * The operational projection. **The one function with no user predicate** — by
 * design, since admin authority is not ownership-scoped (contract §5).
 *
 * It is therefore the function that must never return clinical columns, and the
 * reason `OPERATIONAL_COLUMNS` is an explicit list rather than `select("*")`.
 */
export function getCaseOperational(id: string): Promise<ClinicalResult<CaseRow>> {
  return readCaseScoped(OPERATIONAL_COLUMNS, (query) => query, id)
}

// --------------------------------------------------------------------------- //
// Reads that hang off a case
// --------------------------------------------------------------------------- //

/** Every decision recorded on a case, newest first. `withNote` is false for the admin projection. */
export async function getCaseReviews(
  analysisId: string,
  withNote: boolean,
): Promise<ClinicalResult<CaseReviewRow[]>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data, error } = await supabase
      .from("case_reviews")
      .select(withNote ? REVIEW_COLUMNS : REVIEW_ATTRIBUTION_COLUMNS)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })

    if (error) return fail("unavailable")
    return { ok: true, data: (data ?? []) as unknown as CaseReviewRow[] }
  } catch {
    return fail("unavailable")
  }
}

/**
 * Every version of every report on a case, newest version first.
 *
 * Two hops, because `report_versions` links to `generated_reports` and only that
 * table carries `analysis_id`. Written as two statements rather than an embedded
 * select so the predicate stays visible — and so the suite's stub can express it.
 */
export async function getCaseVersions(
  analysisId: string,
  withContent: boolean,
): Promise<ClinicalResult<ReportVersionRow[]>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: reports, error: reportsError } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("analysis_id", analysisId)

    if (reportsError) return fail("unavailable")

    const reportIds = ((reports ?? []) as { id: string }[]).map((r) => r.id)
    if (reportIds.length === 0) return { ok: true, data: [] }

    const collected: ReportVersionRow[] = []
    for (const reportId of reportIds) {
      const { data, error } = await supabase
        .from("report_versions")
        .select(withContent ? VERSION_COLUMNS : VERSION_ATTRIBUTION_COLUMNS)
        .eq("report_id", reportId)
        .order("version_number", { ascending: false })

      if (error) return fail("unavailable")
      collected.push(...((data ?? []) as unknown as ReportVersionRow[]))
    }

    return { ok: true, data: collected }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 5. claimCase — the compare-and-set
// --------------------------------------------------------------------------- //

/**
 * Take a case, if nobody else has.
 *
 * `review_state = 'claimed'` is set in the **same statement** as `claimed_by`
 * (E1). Two statements leave a window in which the case is held but still reads
 * as awaiting review, and every queue reader in that window sees a case it can
 * neither claim nor act on.
 *
 * `.eq("review_state", "awaiting_review")` is a third predicate beyond the two
 * contract §5 names. It is the `awaiting_review → claimed` edge of
 * `ALLOWED_CASE_TRANSITIONS`, enforced where the write happens — no database
 * trigger guards this machine, so the statement is the only place it can hold.
 *
 * Zero rows means the compare-and-set lost, and three different things can cause
 * it. The probe (E2) is what separates them: without it the loser is told 404
 * for a case that plainly exists.
 */
export async function claimCase(
  id: string,
  userId: string,
  now: Date = new Date(),
): Promise<ClinicalResult<CaseRow>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data, error } = await supabase
      .from("medical_analyses")
      .update({
        claimed_by: userId,
        claimed_at: now.toISOString(),
        review_state: "claimed" satisfies CaseReviewState,
        updated_at: now.toISOString(),
      })
      .eq("id", id)
      .is("claimed_by", null)
      .eq("review_state", "awaiting_review")
      .select(CLINICIAN_COLUMNS)

    if (error) return fail("unavailable")

    const claimed = (data ?? []) as unknown as CaseRow[]
    if (claimed.length === 1) return { ok: true, data: claimed[0] }

    // Lost the race, or never eligible. One probe, three answers.
    const { data: probe } = await supabase
      .from("medical_analyses")
      .select("id, claimed_by, review_state")
      .eq("id", id)
      .maybeSingle()

    if (!probe) return fail("not_found")

    const row = probe as { claimed_by: string | null; review_state: string | null }
    if (row.claimed_by) return fail("already_claimed")
    return fail("invalid_transition")
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 6. recordReview — decision, and version 1 with it
// --------------------------------------------------------------------------- //

/**
 * `report_versions.report_id` is `NOT NULL`, and D2 requires the decision to
 * produce version 1 — so a `generated_reports` row has to exist before the
 * decision can be written.
 *
 * **Nothing else creates one for a case in review.** D4 refuses the patient's
 * own generate path once `review_state` is non-null, so a case that entered
 * review before anyone generated a report would deadlock: no report row, no
 * version 1, no decision. This resolves the newest existing row and creates one
 * only when there is none.
 *
 * The row is created in `pending` with no `storage_path`. It is a container for
 * versions, not a generated document — `report_generator` is unchanged (D2), and
 * the PDF arrives through the existing path, whose digest is taken at signature
 * (D1). A row claiming `completed` with nothing stored would be a lie the
 * preview route would then have to discover.
 */
async function ensureReportForCase(
  analysisId: string,
  caseOwnerId: string,
  clinicianId: string,
): Promise<ClinicalResult<string>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: existing, error: readError } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (readError) return fail("unavailable")

    const found = (existing ?? []) as { id: string }[]
    if (found.length > 0) return { ok: true, data: found[0].id }

    const { data: created, error: insertError } = await supabase
      .from("generated_reports")
      .insert({
        user_id: caseOwnerId,
        clinician_id: clinicianId,
        analysis_id: analysisId,
        report_type: "clinician_report",
        report_number: makeReportNumber(),
        generation_status: "pending",
      })
      .select("id")

    if (insertError) return fail("unavailable")

    const rows = (created ?? []) as { id: string }[]
    if (rows.length !== 1) return fail("unavailable")
    return { ok: true, data: rows[0].id }
  } catch {
    return fail("unavailable")
  }
}

export interface RecordReviewInput {
  outcome: ReviewOutcome
  note: string
}

/**
 * Record a decision, or ask for more data.
 *
 * The scoped read runs first and is the authority check: `claimed_by = userId`,
 * so a clinician acting on another's claim gets `not_found` exactly as a reader
 * would (contract §4 row 8). The `plpgsql` function re-asserts the same
 * predicate inside the transaction, which is not redundancy — the read cannot
 * hold a lock across the round trip, and only the write statement can be atomic
 * with the two inserts beside it (D3).
 */
export async function recordReview(
  id: string,
  userId: string,
  input: RecordReviewInput,
): Promise<ClinicalResult<{ review_id: string | null }>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: held, error: readError } = await supabase
      .from("medical_analyses")
      .select("id, user_id, review_state, claimed_by")
      .eq("id", id)
      .eq("claimed_by", userId)
      .maybeSingle()

    if (readError) return fail("unavailable")
    if (!held) return fail("not_found")

    const held_ = held as { user_id: string; review_state: string | null }
    if (held_.review_state !== "claimed") return fail("invalid_transition")

    // Only a recorded decision produces a version; a request for more data has
    // nothing to version yet, and the function skips the insert for it.
    let reportId: string | null = null
    if (input.outcome === "decision_recorded") {
      const report = await ensureReportForCase(id, held_.user_id, userId)
      if (!report.ok) return report
      reportId = report.data
    }

    const { data, error } = await supabase.rpc("record_case_decision", {
      p_analysis_id: id,
      p_clinician_id: userId,
      p_outcome: input.outcome,
      p_note: input.note,
      p_report_id: reportId,
      // The snapshot version 1 carries. The clinician's words and the model
      // output as it stood, not a rendering of either — the PDF is a separate
      // artifact whose digest is taken at signature (D1).
      p_content:
        input.outcome === "decision_recorded"
          ? {
              decision: { outcome: input.outcome, note: input.note, clinician_id: userId },
              recorded_at: new Date().toISOString(),
            }
          : null,
    })

    // The function raises when the case is not held in a state a decision can be
    // recorded from — and the raise rolls back the inserts before it (D3).
    if (error) return fail("invalid_transition")

    return { ok: true, data: { review_id: (data as string | null) ?? null } }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 7-8. The two version writes
// --------------------------------------------------------------------------- //

/**
 * The version, and proof that the caller holds the case it belongs to.
 *
 * Three statements rather than a two-level embedded select. `report_versions`
 * reaches `medical_analyses` only through `generated_reports`, and a nested
 * `!inner` embed states that path in a filter string no reader can check and no
 * stub can express. Signing is rare and human-initiated; the round trips cost
 * nothing that matters.
 *
 * Every miss is `not_found` — an unheld case and an absent version are the same
 * answer, for the reason contract §2 gives.
 */
async function readVersionForClaimant(
  versionId: string,
  userId: string,
): Promise<ClinicalResult<{ version: ReportVersionRow; analysisId: string; reportPath: string | null }>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: version, error: versionError } = await supabase
      .from("report_versions")
      .select(VERSION_COLUMNS)
      .eq("id", versionId)
      .maybeSingle()

    if (versionError) return fail("unavailable")
    if (!version) return fail("not_found")

    const row = version as unknown as ReportVersionRow

    const { data: report, error: reportError } = await supabase
      .from("generated_reports")
      .select("id, analysis_id, storage_path")
      .eq("id", row.report_id)
      .maybeSingle()

    if (reportError) return fail("unavailable")
    if (!report) return fail("not_found")

    const reportRow = report as { analysis_id: string; storage_path: string | null }

    const { data: held, error: heldError } = await supabase
      .from("medical_analyses")
      .select("id")
      .eq("id", reportRow.analysis_id)
      .eq("claimed_by", userId)
      .maybeSingle()

    if (heldError) return fail("unavailable")
    if (!held) return fail("not_found")

    return {
      ok: true,
      data: { version: row, analysisId: reportRow.analysis_id, reportPath: reportRow.storage_path },
    }
  } catch {
    return fail("unavailable")
  }
}

/**
 * A digest of the stored PDF as it stood at signature time (D1).
 *
 * Returns `null` when no document is stored — version 1 is created as a `draft`
 * with a JSON snapshot and no PDF, so a clinician can legitimately reach
 * signature before the document exists. Refusing to sign there would deadlock
 * the only path that produces one. The signature still covers `content`, which
 * is what spec A5's attestation always meant; the digest is the extra fact D1
 * adds when there is an artifact to describe.
 *
 * What it proves is narrow, and FR-054 holds: it detects that the stored
 * document drifted from what was signed. It does not prove who changed it, and
 * nothing may describe it as cryptographic verification.
 */
export async function probeStoredDocument(storagePath: string | null): Promise<DocumentProbe> {
  if (!storagePath) return { found: false, digest: null }

  const supabase = getSupabaseAdmin()
  if (!supabase) return { found: false, digest: null }

  const { data, error } = await supabase.storage.from(REPORT_STORAGE_BUCKET).download(storagePath)
  if (error || !data) return { found: false, digest: null }

  const bytes = await data.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return {
    found: true,
    digest: `sha256:${Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`,
  }
}

/**
 * Signature-time digest. A thin read of the probe, kept as its own name because
 * signing wants the hash and does not care whether the miss was an absent path
 * or an absent object — at signature time both mean the same thing (T029).
 *
 * **On read they do not mean the same thing**, which is why the probe exists:
 * `null` here collapses "no document" and "a document that hashes to nothing",
 * and T050 turns on telling a missing file apart from a missing signature.
 */
async function digestStoredDocument(storagePath: string | null): Promise<string | null> {
  return (await probeStoredDocument(storagePath)).digest
}

/**
 * What a version's document looks like right now. The probe plus the pure
 * decision, so no caller performs the comparison itself (T050, T052).
 *
 * One download per call, so this belongs on a detail surface and never in a
 * list: hashing every row of a queue to render a badge would pull every stored
 * PDF on every page load.
 */
export async function describeVersionDocument(
  version: VersionDocumentInput,
): Promise<VersionDocumentState> {
  if (!version.signed_at) return "unsigned"
  return versionDocumentState(version, await probeStoredDocument(version.storage_path))
}

/**
 * Sign a version. Compare-and-set on `signed_at IS NULL`, so a second concurrent
 * signature loses rather than overwriting the first.
 *
 * The append-only trigger guards `signed_at`, `signed_by`, `content`,
 * `content_digest` and `storage_path` once signed — so this write is the only
 * chance to record what was signed over, and it happens in the same statement.
 */
export async function signVersion(
  versionId: string,
  userId: string,
  rationale: string | null = null,
  now: Date = new Date(),
): Promise<ClinicalResult<ReportVersionRow>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  const found = await readVersionForClaimant(versionId, userId)
  if (!found.ok) return found

  if (found.data.version.signed_at) return fail("already_signed")

  try {
    const storagePath = found.data.reportPath
    const digest = await digestStoredDocument(storagePath)

    const { data, error } = await supabase
      .from("report_versions")
      .update({
        signed_by: userId,
        signed_at: now.toISOString(),
        state: "signed" satisfies VersionState,
        content_digest: digest,
        storage_path: storagePath,
        ...(rationale === null ? {} : { sign_rationale: rationale }),
      })
      .eq("id", versionId)
      .is("signed_at", null)
      .select(VERSION_COLUMNS)

    if (error) return fail("already_signed")

    const signed = (data ?? []) as unknown as ReportVersionRow[]
    if (signed.length !== 1) return fail("already_signed")

    await supabase
      .from("medical_analyses")
      .update({ review_state: "signed" satisfies CaseReviewState, updated_at: now.toISOString() })
      .eq("id", found.data.analysisId)
      .eq("claimed_by", userId)

    return { ok: true, data: signed[0] }
  } catch {
    return fail("unavailable")
  }
}

/**
 * Release a signed version to the patient.
 *
 * `released_at` is the patient-visibility gate, not `signed_at` (FR-026), and
 * `015`'s `check (released_at is null or signed_at is not null)` means the
 * database refuses an unsigned release regardless of what this function does.
 * The `.not("signed_at", "is", null)` predicate is here so the caller gets a
 * stated 409 instead of a constraint violation.
 *
 * E4: the stored object is confirmed to exist **before** `released_at` is
 * written. Releasing a version whose document is missing tells a patient their
 * report is ready and then shows them nothing — worse than refusing, because the
 * refusal is recoverable and the broken release is not.
 */
export async function releaseVersion(
  versionId: string,
  userId: string,
  now: Date = new Date(),
): Promise<ClinicalResult<ReportVersionRow>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  const found = await readVersionForClaimant(versionId, userId)
  if (!found.ok) return found

  const version = found.data.version
  if (!version.signed_at) return fail("not_signed")

  const storagePath = version.storage_path ?? found.data.reportPath
  if (!storagePath) return fail("document_missing")

  try {
    const { error: storageError } = await supabase.storage
      .from(REPORT_STORAGE_BUCKET)
      .download(storagePath)

    if (storageError) return fail("document_missing")

    const { data, error } = await supabase
      .from("report_versions")
      .update({
        released_by: userId,
        released_at: now.toISOString(),
      })
      .eq("id", versionId)
      .not("signed_at", "is", null)
      .is("released_at", null)
      .select(VERSION_COLUMNS)

    if (error) return fail("unavailable")

    const released = (data ?? []) as unknown as ReportVersionRow[]
    if (released.length !== 1) return fail("not_signed")

    await supabase
      .from("medical_analyses")
      .update({ review_state: "released" satisfies CaseReviewState, updated_at: now.toISOString() })
      .eq("id", found.data.analysisId)
      .eq("claimed_by", userId)

    return { ok: true, data: released[0] }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 9. resumeReview — the return loop (T051, FR-007)
// --------------------------------------------------------------------------- //

/**
 * Send a case that was waiting on the patient back into the review queue.
 *
 * `more_data_requested → awaiting_review`, and **`claimed_by` is deliberately
 * left alone** (D5). That single omission is the whole of the named assertion:
 * `getReviewQueue` admits a row when `claimed_by is null OR claimed_by = $user`,
 * so a case that keeps its claimant reappears in that clinician's own list and
 * in nobody else's. Clearing `claimed_by` here would drop a case with a
 * half-finished review back into the shared pool for anyone to pick up.
 *
 * The scoped read is the authority check, exactly as `recordReview` does it: a
 * clinician who does not hold the case gets `not_found`, never a 403 that would
 * confirm the id exists (FR-031).
 *
 * `.eq("review_state", "more_data_requested")` in the write statement is the
 * transition edge enforced where the write happens — no trigger guards this
 * machine, so the statement is the only place it can hold. Zero rows means the
 * state moved under us between read and write, which is `invalid_transition`.
 *
 * WHAT TRIGGERS THIS IS NOT DECIDED HERE, and the task says so. Under spec A4 a
 * case root *is* the analysis row, and no flow exists by which a patient adds
 * data to an existing analysis — a new upload is a new row, which is a new case.
 * So this endpoint is a clinician saying "I have what I needed", not a patient
 * supplying it. Inventing the patient-side flow was explicitly out of scope; it
 * is a fifth entry for A4's unrepresentable-states table and needs an owner
 * decision before FR-007 is honoured end to end.
 */
export async function resumeReview(
  id: string,
  userId: string,
  now: Date = new Date(),
): Promise<ClinicalResult<{ id: string }>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: held, error: readError } = await supabase
      .from("medical_analyses")
      .select("id, review_state, claimed_by")
      .eq("id", id)
      .eq("claimed_by", userId)
      .maybeSingle()

    if (readError) return fail("unavailable")
    if (!held) return fail("not_found")

    const held_ = held as { review_state: string | null }
    if (held_.review_state !== "more_data_requested") return fail("invalid_transition")

    const { data, error } = await supabase
      .from("medical_analyses")
      .update({
        review_state: "awaiting_review" satisfies CaseReviewState,
        updated_at: now.toISOString(),
      })
      .eq("id", id)
      .eq("claimed_by", userId)
      .eq("review_state", "more_data_requested")
      .select("id")

    if (error) return fail("unavailable")

    const moved = (data ?? []) as { id: string }[]
    if (moved.length !== 1) return fail("invalid_transition")

    return { ok: true, data: { id: moved[0].id } }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 10. getReleasedVersionsByAnalysis — what a patient may read (T042, FR-026)
// --------------------------------------------------------------------------- //

/**
 * The released version of each of this patient's cases, newest version first.
 *
 * Release is the patient-visibility gate, not signature (FR-026) — so the
 * predicate is `released_at is not null` and nothing weaker. A signed-but-
 * unreleased version is withheld here for the same reason T018 withholds it at
 * the API layer.
 *
 * `generated_reports.user_id = userId` is the ownership scope. It is applied on
 * the first hop because that is the only table of the two carrying a user, and
 * the service-role client bypasses RLS — an unscoped first hop would hand every
 * patient's released reports to whoever asked.
 *
 * A corrected version **keeps its `released_at`** and gains
 * `correction_started_at` (migration 015, FR-029). It therefore still matches
 * this predicate and stays readable while the replacement is drafted, which is
 * SC-012: there is no interval in which the patient sees nothing.
 */
export async function getReleasedVersionsByAnalysis(
  userId: string,
): Promise<ClinicalResult<Record<string, ReportVersionRow>>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data: reports, error: reportsError } = await supabase
      .from("generated_reports")
      .select("id, analysis_id")
      .eq("user_id", userId)

    if (reportsError) return fail("unavailable")

    const owned = (reports ?? []) as { id: string; analysis_id: string }[]
    if (owned.length === 0) return { ok: true, data: {} }

    const analysisByReport = new Map(owned.map((r) => [r.id, r.analysis_id]))

    const { data, error } = await supabase
      .from("report_versions")
      .select(VERSION_COLUMNS)
      .in(
        "report_id",
        owned.map((r) => r.id),
      )
      .not("released_at", "is", null)
      .order("version_number", { ascending: false })

    if (error) return fail("unavailable")

    // Newest version wins per case: the rows arrive version-descending, so the
    // first sighting of an analysis is the one to keep.
    const latest: Record<string, ReportVersionRow> = {}
    for (const row of (data ?? []) as unknown as ReportVersionRow[]) {
      const analysisId = analysisByReport.get(row.report_id)
      if (analysisId && !latest[analysisId]) latest[analysisId] = row
    }

    return { ok: true, data: latest }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 11. getOperationalCases — the admin work list (T044, FR-062)
// --------------------------------------------------------------------------- //

/**
 * Every case, as operational facts alone.
 *
 * Separate from `getReviewQueue` because that function selects
 * `CLINICIAN_COLUMNS` — image, diagnosis, confidence, risk level. Reusing it and
 * dropping fields in the page would put the clinical content one render away
 * from an admin surface that FR-062 says must never carry it. The column list is
 * the enforcement, and it is applied in the query.
 *
 * Unlike the clinician queue there is no `claimed_by` predicate: operational
 * oversight covers every case, held or not. The `review_state is not null`
 * predicate stays — a historical row has no clinical lifecycle to report on and
 * would read as a case stuck at the start of one (FR-044).
 *
 * Newest first, which is the opposite of the clinician queue and correct for a
 * different question: a clinician asks what has waited longest, an operator asks
 * what happened recently.
 */
export async function getOperationalCases(): Promise<ClinicalResult<CaseRow[]>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")

  try {
    const { data, error } = await supabase
      .from("medical_analyses")
      .select(OPERATIONAL_COLUMNS)
      .not("review_state", "is", null)
      .order("created_at", { ascending: false })

    if (error) return fail("unavailable")
    return { ok: true, data: (data ?? []) as unknown as CaseRow[] }
  } catch {
    return fail("unavailable")
  }
}

// --------------------------------------------------------------------------- //
// 12. getOperationalAttribution — who did what, in bulk (T044)
// --------------------------------------------------------------------------- //

/** Attribution for one case. No note, no content, no digest, no storage path. */
export interface CaseAttribution {
  reviews: CaseReviewRow[]
  versions: ReportVersionRow[]
}

/**
 * Attribution for many cases in three queries, not three per case.
 *
 * The admin surface renders every case it lists, so the per-case readers
 * (`getCaseReviews`, `getCaseVersions`) would issue 2N round trips against a
 * table that grows with every analysis ever run. Three bounded queries do the
 * same work: reviews by `analysis_id`, the reports that link versions to cases,
 * then versions by `report_id`.
 *
 * **Attribution columns only, in both selects.** `REVIEW_ATTRIBUTION_COLUMNS`
 * omits `note` and `VERSION_ATTRIBUTION_COLUMNS` omits `content` — what was done
 * and by whom is operational, what a clinician *wrote* is clinical content an
 * operator has no business reading (FR-062). Passing `withNote`/`withContent`
 * here would put that decision at a call site instead of in the query.
 */
export async function getOperationalAttribution(
  analysisIds: string[],
): Promise<ClinicalResult<Record<string, CaseAttribution>>> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return fail("unavailable")
  if (analysisIds.length === 0) return { ok: true, data: {} }

  try {
    const [reviewsResult, reportsResult] = await Promise.all([
      supabase
        .from("case_reviews")
        .select(`${REVIEW_ATTRIBUTION_COLUMNS}, analysis_id`)
        .in("analysis_id", analysisIds)
        .order("created_at", { ascending: false }),
      supabase.from("generated_reports").select("id, analysis_id").in("analysis_id", analysisIds),
    ])

    if (reviewsResult.error || reportsResult.error) return fail("unavailable")

    const attribution: Record<string, CaseAttribution> = Object.fromEntries(
      analysisIds.map((id) => [id, { reviews: [], versions: [] }]),
    )

    for (const row of (reviewsResult.data ?? []) as unknown as (CaseReviewRow & {
      analysis_id: string
    })[]) {
      attribution[row.analysis_id]?.reviews.push(row)
    }

    const owned = (reportsResult.data ?? []) as { id: string; analysis_id: string }[]
    if (owned.length === 0) return { ok: true, data: attribution }

    const analysisByReport = new Map(owned.map((r) => [r.id, r.analysis_id]))

    const { data: versions, error: versionsError } = await supabase
      .from("report_versions")
      .select(VERSION_ATTRIBUTION_COLUMNS)
      .in(
        "report_id",
        owned.map((r) => r.id),
      )
      .order("version_number", { ascending: false })

    if (versionsError) return fail("unavailable")

    for (const row of (versions ?? []) as unknown as ReportVersionRow[]) {
      const analysisId = analysisByReport.get(row.report_id)
      if (analysisId) attribution[analysisId]?.versions.push(row)
    }

    return { ok: true, data: attribution }
  } catch {
    return fail("unavailable")
  }
}
