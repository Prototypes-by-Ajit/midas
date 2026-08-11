/**
 * The five decisions `app/api/reports/generate/route.ts` makes, extracted so a
 * runner can reach them.
 *
 * Eleven branches in that handler decide what the caller sent; whether an outcome
 * is complete, degraded or failed; what gets written to the row; and which rows
 * survive a refresh. All of them sat inside a handler that needs Clerk, Supabase
 * and a live backend to execute, so none of them were ever tested. These five
 * functions are pure: no I/O, no React, no Supabase client, no clock they do not
 * receive.
 *
 * Tested by `orchestration.test.ts`.
 */

import { z } from "zod"

import {
  NARRATIVE_SECTIONS,
  REPORT_STALE_MS,
  REPORT_TYPES,
  type NarrativeSection,
  type ReportProvenance,
  type ReportType,
  type SectionsGenerated,
} from "./contract"

/** The reason recorded when a 200 arrives with nothing to say about itself. */
export const PROVENANCE_UNAVAILABLE = "provenance unavailable"

/** What `classifyBackendResult` reads off a backend response. */
export interface BackendResult {
  status: number
  headers: Headers
}

export interface BackendClassification {
  generation_status: "completed" | "degraded" | "failed"
  provenance: ReportProvenance | null
  error?: string
}

/**
 * A `generated_reports` row as the console consumes it.
 *
 * `generation_status` is `string`, not `ReportStatus`: a historical row may carry
 * a value outside the closed set, and it is displayed verbatim and treated as
 * terminal rather than rewritten (Assumption 2).
 */
export interface ReportRow {
  id: string
  generation_status: string
  created_at: string
  [key: string]: unknown
}

export interface FinalizePatch {
  generation_status: "completed" | "degraded" | "failed"
  sections_generated: SectionsGenerated | null
  generator: string | null
  degraded_reason: string | null
  storage_path?: string
  generated_at?: string
  error_message?: string
}

const TERMINAL = new Set(["completed", "degraded", "failed"])

function noSections(): SectionsGenerated {
  return Object.fromEntries(
    NARRATIVE_SECTIONS.map((section) => [section, false])
  ) as SectionsGenerated
}

// --------------------------------------------------------------------------- //
// 1. Parse what the caller asked for
// --------------------------------------------------------------------------- //

/**
 * The declared shape of `config`. Unknown keys are an error, not a silent drop.
 *
 * The four `include*` flags are optional and carry **no defaults**. A default
 * here would be this function inventing an instruction nobody gave, which is the
 * same class of mistake as the substitution it replaces.
 */
export const reportConfigSchema = z
  .object({
    reportType: z.enum(REPORT_TYPES),
    includeImages: z.boolean().optional(),
    includeDetailedFeatures: z.boolean().optional(),
    includeRecommendations: z.boolean().optional(),
    includeDisclaimer: z.boolean().optional(),
  })
  .strict()

export type ReportConfigInput = z.infer<typeof reportConfigSchema>

export type ParsedReportConfig =
  | { ok: true; config: ReportConfigInput; reportType: ReportType }
  | { ok: false; code: "INVALID_REPORT_TYPE" | "INVALID_CONFIG"; message: string }

/**
 * What the caller asked for, or a refusal naming exactly what was wrong.
 *
 * `config?.reportType || 'diagnostic_summary'` stood here. Three distinct failures
 * shared that one line: a missing type silently became a diagnostic summary, an
 * unrecognised type did too, and the entire `config` object was persisted to
 * `report_config` unread, so any key a caller invented was stored as though it
 * meant something. Someone who asks for a clinician report and receives a
 * diagnostic summary cannot discover the substitution — the document does not name
 * its own type.
 *
 * Rejecting unknown keys rather than stripping them is the louder of the two
 * options and the correct one: a stripped key leaves the caller believing an
 * option took effect.
 */
export function parseReportConfig(config: unknown): ParsedReportConfig {
  const result = reportConfigSchema.safeParse(config)

  if (result.success) {
    return { ok: true, config: result.data, reportType: result.data.reportType }
  }

  const supported = REPORT_TYPES.join(", ")
  const typeIssue = result.error.issues.find((issue) => issue.path[0] === "reportType")

  if (typeIssue) {
    // Absent and wrong are different mistakes and get different sentences. The
    // presence test rather than the issue code keeps this stable across zod
    // versions, which have renamed the enum-mismatch code more than once.
    const provided =
      typeof config === "object" && config !== null && "reportType" in config

    return {
      ok: false,
      code: "INVALID_REPORT_TYPE",
      message: provided
        ? `reportType must be one of: ${supported}.`
        : `reportType is required. Supported types: ${supported}.`,
    }
  }

  const detail = result.error.issues
    .map((issue) =>
      issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message
    )
    .join("; ")

  return {
    ok: false,
    code: "INVALID_CONFIG",
    message: `The report options were not understood. ${detail}`,
  }
}

// --------------------------------------------------------------------------- //
// 2. Classify
// --------------------------------------------------------------------------- //

/**
 * Decide what the report service actually produced, from its headers alone.
 *
 * The service returns PDF bytes, so the outcome cannot be read from the body
 * without parsing the document. `X-Report-Sections` is the whole signal.
 *
 * A 200 carrying no `X-Report-Sections` has told us nothing, and is classified
 * `degraded` — not `completed`. Assuming four sections from silence is precisely
 * how a failure becomes a finished report.
 */
export function classifyBackendResult(result: BackendResult): BackendClassification {
  if (result.status < 200 || result.status >= 300) {
    return {
      generation_status: "failed",
      provenance: null,
      error: `Report service returned ${result.status}`,
    }
  }

  const header = result.headers.get("X-Report-Sections")
  if (!header) {
    return {
      generation_status: "degraded",
      provenance: {
        sections_generated: noSections(),
        generator: result.headers.get("X-Report-Generator"),
        degraded_reason: PROVENANCE_UNAVAILABLE,
      },
    }
  }

  const present = new Set(
    header
      .split(",")
      .map((section) => section.trim())
      .filter(Boolean)
  )
  const sections_generated = Object.fromEntries(
    NARRATIVE_SECTIONS.map((section: NarrativeSection) => [section, present.has(section)])
  ) as SectionsGenerated

  const complete = NARRATIVE_SECTIONS.every((section) => sections_generated[section])
  const declaredReason = result.headers.get("X-Report-Degraded")

  return {
    generation_status: complete && !declaredReason ? "completed" : "degraded",
    provenance: {
      sections_generated,
      generator: result.headers.get("X-Report-Generator"),
      degraded_reason: complete && !declaredReason ? null : declaredReason || PROVENANCE_UNAVAILABLE,
    },
  }
}

// --------------------------------------------------------------------------- //
// 3. Finalize
// --------------------------------------------------------------------------- //

/**
 * The row patch written once the document has been stored — or has not been.
 *
 * `completed` is a promise that Preview and Download will work (FR-035). Without
 * a storage path there is nothing to preview, so no storage path means no
 * `completed`, whatever the narrative did.
 *
 * Provenance is persisted here rather than only emitted in a header: without this
 * the `014` columns stay NULL on every new row and FR-018 is unwritable.
 */
export function finalizePatch(
  classification: BackendClassification,
  storagePath: string | null,
  generatedAt: string = new Date().toISOString()
): FinalizePatch {
  const provenance = {
    sections_generated: classification.provenance?.sections_generated ?? null,
    generator: classification.provenance?.generator ?? null,
    degraded_reason: classification.provenance?.degraded_reason ?? null,
  }

  if (classification.generation_status === "failed") {
    return {
      ...provenance,
      generation_status: "failed",
      error_message: classification.error ?? "Report generation failed",
    }
  }

  if (!storagePath) {
    return {
      ...provenance,
      generation_status: "failed",
      error_message: "The report was generated but could not be saved.",
    }
  }

  return {
    ...provenance,
    generation_status: classification.generation_status,
    storage_path: storagePath,
    generated_at: generatedAt,
  }
}

// --------------------------------------------------------------------------- //
// 4. Hydrate
// --------------------------------------------------------------------------- //

/**
 * Merge the durable server rows with whatever this tab still has in flight.
 *
 * The refresh-loss defect is the empty-map case: the console seeded its state
 * from an empty `useState`, so after a reload the list showed nothing until the
 * person generated something in that same browser session. Every server row must
 * survive an empty in-flight map.
 *
 * A terminal server row always wins. The row finished while this tab still
 * believed it was generating; the optimistic entry is stale by definition.
 */
export function hydrateReports(
  serverRows: ReportRow[],
  inFlight: Map<string, ReportRow>
): ReportRow[] {
  const merged = serverRows.map((row) => {
    const optimistic = inFlight.get(row.id)
    if (!optimistic || TERMINAL.has(row.generation_status)) return row
    return optimistic
  })

  const known = new Set(serverRows.map((row) => row.id))
  for (const [id, row] of inFlight) {
    if (!known.has(id)) merged.push(row)
  }

  return merged
}

// --------------------------------------------------------------------------- //
// 5. Staleness
// --------------------------------------------------------------------------- //

/**
 * Whether a `generating` row should be presented as *Didn't finish*.
 *
 * No transition exists when the observer dies mid-generation — the tab closed,
 * the request was abandoned — so nothing ever moves the row off `generating`.
 * Once history is durable that "Generating…" is permanent, so staleness is
 * decided at read time instead (D9).
 *
 * The boundary is inclusive: at exactly `REPORT_STALE_MS` the row is stale. Only
 * `generating` can be stale; every other status is already an answer.
 */
export function isStale(row: ReportRow, now: number): boolean {
  if (row.generation_status !== "generating") return false

  const started = Date.parse(row.created_at)
  if (Number.isNaN(started)) return false

  return now - started >= REPORT_STALE_MS
}
