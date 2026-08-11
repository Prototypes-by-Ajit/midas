/**
 * T015 [US2] — the orchestration decisions, made where a runner can reach them.
 *
 * `app/api/reports/generate/route.ts` decides eleven things — is this outcome
 * complete, degraded, or failed; what gets written to the row; which rows the
 * console shows after a refresh — and every one of them sits inside a handler
 * that needs Clerk, Supabase, and a live backend to execute. Nothing tests them.
 * T020 extracts the four decisions as pure functions; this pins what they must
 * decide, first.
 *
 * CONTRACT ASSUMED (T019 + T020). The module does not exist yet, so these tests
 * fail on the import until it does. The shape they assume:
 *
 *   classifyBackendResult({status, headers}) ->
 *     { generation_status: 'completed' | 'degraded' | 'failed',
 *       provenance: {sections_generated, generator, degraded_reason} | null,
 *       error?: string }
 *
 *   finalizePatch(classification, storagePath: string | null) -> row patch
 *   hydrateReports(serverRows, inFlight: Map<string, row>) -> row[]
 *   isStale(row, now: number) -> boolean          // generating, older than REPORT_STALE_MS
 *
 * Loaded with a dynamic import so a missing module fails each test on its own
 * assertion rather than collapsing the file into one collection error.
 */

import { describe, expect, it } from "vitest"

type Orchestration = typeof import("./orchestration")
type Contract = typeof import("./contract")

const load = async (): Promise<Orchestration & Contract> => ({
  ...(await import("./orchestration")),
  ...(await import("./contract")),
})

const ALL_SECTIONS = "summary,observations,recommendations,limitations"

const backendResult = (status: number, headers: Record<string, string> = {}) => ({
  status,
  headers: new Headers(headers),
})

const completeResult = () =>
  backendResult(200, {
    "X-Report-Sections": ALL_SECTIONS,
    "X-Report-Generator": "meta/llama-3.3-70b-instruct",
  })

const row = (over: Record<string, unknown> = {}) => ({
  id: "b4d1e7f0-1234-4c56-89ab-cdef01234567",
  report_number: "MIDAS-REP-20260714-K3P9XQ",
  report_type: "clinician_report",
  generation_status: "completed",
  created_at: "2026-07-14T09:22:31.884Z",
  ...over,
})

// --------------------------------------------------------------------------- //
// classifyBackendResult
// --------------------------------------------------------------------------- //

describe("classifyBackendResult", () => {
  it("calls a four-of-four response completed", async () => {
    const { classifyBackendResult } = await load()
    const result = classifyBackendResult(completeResult())

    expect(result.generation_status).toBe("completed")
    expect(result.provenance?.sections_generated).toEqual({
      summary: true,
      observations: true,
      recommendations: true,
      limitations: true,
    })
    expect(result.provenance?.degraded_reason).toBeNull()
  })

  it("never calls a response with no provenance header completed", async () => {
    // A backend that answered 200 without saying what it produced has told us
    // nothing. Assuming four sections is how a failure becomes a finished report.
    const { classifyBackendResult } = await load()
    const result = classifyBackendResult(backendResult(200))

    expect(result.generation_status).toBe("degraded")
    expect(result.provenance?.degraded_reason).toBe("provenance unavailable")
  })

  it("calls any absent section degraded, and names it", async () => {
    const { classifyBackendResult } = await load()
    const result = classifyBackendResult(
      backendResult(200, {
        "X-Report-Sections": "summary",
        "X-Report-Generator": "meta/llama-3.3-70b-instruct",
        "X-Report-Degraded": "observations, recommendations and limitations were not generated",
      })
    )

    expect(result.generation_status).toBe("degraded")
    expect(result.provenance?.sections_generated).toMatchObject({
      summary: true,
      observations: false,
      recommendations: false,
      limitations: false,
    })
    expect(result.provenance?.degraded_reason).toBeTruthy()
  })

  it.each([401, 404, 422, 500, 502, 503])("calls %i failed", async (status) => {
    const { classifyBackendResult } = await load()
    expect(classifyBackendResult(backendResult(status)).generation_status).toBe("failed")
  })

  it("returns a status that is always a member of REPORT_STATUSES", async () => {
    const { classifyBackendResult, REPORT_STATUSES } = await load()
    for (const result of [completeResult(), backendResult(200), backendResult(502)]) {
      expect(REPORT_STATUSES).toContain(classifyBackendResult(result).generation_status)
    }
  })
})

// --------------------------------------------------------------------------- //
// finalizePatch
// --------------------------------------------------------------------------- //

describe("finalizePatch", () => {
  it("never writes completed without a stored document", async () => {
    // FR-035: `completed` is a promise that Preview and Download will work.
    const { classifyBackendResult, finalizePatch } = await load()
    const patch = finalizePatch(classifyBackendResult(completeResult()), null)

    expect(patch.generation_status).not.toBe("completed")
  })

  it("writes completed with its storage path when the document is stored", async () => {
    const { classifyBackendResult, finalizePatch } = await load()
    const path = "user_2abc/reports/b4d1e7f0_clinician_report.pdf"
    const patch = finalizePatch(classifyBackendResult(completeResult()), path)

    expect(patch.generation_status).toBe("completed")
    expect(patch.storage_path).toBe(path)
  })

  it("persists the provenance the row columns exist for", async () => {
    // Without this the 014 columns stay NULL on every new row and FR-018 is
    // unwritable — provenance would exist only in a header nobody kept.
    const { classifyBackendResult, finalizePatch } = await load()
    const patch = finalizePatch(classifyBackendResult(completeResult()), "path.pdf")

    expect(patch.sections_generated).toEqual({
      summary: true,
      observations: true,
      recommendations: true,
      limitations: true,
    })
    expect(patch.generator).toBe("meta/llama-3.3-70b-instruct")
    expect(patch.degraded_reason).toBeNull()
  })

  it("keeps a degraded outcome degraded even when the document stored fine", async () => {
    const { classifyBackendResult, finalizePatch } = await load()
    const classification = classifyBackendResult(backendResult(200))
    const patch = finalizePatch(classification, "path.pdf")

    expect(patch.generation_status).toBe("degraded")
    expect(patch.degraded_reason).toBe("provenance unavailable")
  })
})

// --------------------------------------------------------------------------- //
// hydrateReports — the refresh-loss reproduction
// --------------------------------------------------------------------------- //

describe("hydrateReports", () => {
  it("returns every server row when nothing is in flight", async () => {
    // The defect: reports-console seeds from an empty useState, so a refresh
    // shows nothing until something is generated in this browser session.
    const { hydrateReports } = await load()
    const serverRows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })]

    const hydrated = hydrateReports(serverRows, new Map())

    expect(hydrated).toHaveLength(3)
    expect(hydrated.map((r) => r.id).sort()).toEqual(["a", "b", "c"])
  })

  it("never lets an in-flight entry shadow a terminal server row", async () => {
    // The row finished while this tab still believed it was generating. The
    // durable answer wins; the optimistic one is stale by definition.
    const { hydrateReports } = await load()
    const serverRows = [row({ id: "a", generation_status: "completed" })]
    const inFlight = new Map([["a", row({ id: "a", generation_status: "generating" })]])

    const hydrated = hydrateReports(serverRows, inFlight)

    expect(hydrated).toHaveLength(1)
    expect(hydrated[0].generation_status).toBe("completed")
  })

  it.each(["completed", "degraded", "failed"])(
    "treats %s as terminal",
    async (terminal) => {
      const { hydrateReports } = await load()
      const hydrated = hydrateReports(
        [row({ id: "a", generation_status: terminal })],
        new Map([["a", row({ id: "a", generation_status: "generating" })]])
      )
      expect(hydrated[0].generation_status).toBe(terminal)
    }
  )

  it("keeps an in-flight row the server has not recorded yet", async () => {
    const { hydrateReports } = await load()
    const inFlight = new Map([["new", row({ id: "new", generation_status: "generating" })]])

    const hydrated = hydrateReports([row({ id: "a" })], inFlight)

    expect(hydrated.map((r) => r.id).sort()).toEqual(["a", "new"])
  })
})

// --------------------------------------------------------------------------- //
// isStale
// --------------------------------------------------------------------------- //

describe("isStale", () => {
  it("is false one millisecond before the boundary", async () => {
    const { isStale, REPORT_STALE_MS } = await load()
    const created = Date.parse("2026-07-14T09:22:31.884Z")
    const generating = row({ generation_status: "generating", created_at: "2026-07-14T09:22:31.884Z" })

    expect(isStale(generating, created + REPORT_STALE_MS - 1)).toBe(false)
  })

  it("is true at the boundary", async () => {
    const { isStale, REPORT_STALE_MS } = await load()
    const created = Date.parse("2026-07-14T09:22:31.884Z")
    const generating = row({ generation_status: "generating", created_at: "2026-07-14T09:22:31.884Z" })

    expect(isStale(generating, created + REPORT_STALE_MS)).toBe(true)
  })

  it.each(["pending", "completed", "degraded", "failed"])(
    "never calls a %s row stale, however old",
    async (status) => {
      const { isStale } = await load()
      const created = Date.parse("2026-07-14T09:22:31.884Z")
      expect(isStale(row({ generation_status: status }), created + 86_400_000)).toBe(false)
    }
  )

  it("leaves room for the abort to fire first", async () => {
    // Invariant from plan.md: backend LLM ceiling 180s < abort < stale. A row
    // presented as interrupted while its own request could still succeed would
    // contradict itself on screen.
    const { REPORT_ABORT_MS, REPORT_STALE_MS } = await load()
    expect(180_000).toBeLessThan(REPORT_ABORT_MS)
    expect(REPORT_ABORT_MS).toBeLessThan(REPORT_STALE_MS)
  })
})

/**
 * T049 [US3] — the config the caller sent, read rather than assumed.
 *
 * `config?.reportType || 'diagnostic_summary'` collapsed three distinct mistakes
 * into one silent substitution. Each of them gets its own assertion here, because
 * each of them has a different right answer.
 */
describe("parseReportConfig", () => {
  const valid = {
    reportType: "clinician_report",
    includeImages: true,
    includeDetailedFeatures: true,
    includeRecommendations: true,
    includeDisclaimer: true,
  }

  it("accepts a fully specified config and reports the type asked for", async () => {
    const { parseReportConfig } = await load()
    const result = parseReportConfig(valid)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reportType).toBe("clinician_report")
    expect(result.config).toEqual(valid)
  })

  it.each(["diagnostic_summary", "detailed_analysis", "patient_report", "clinician_report"])(
    "accepts %s — every declared type is reachable",
    async (reportType) => {
      const { parseReportConfig } = await load()
      const result = parseReportConfig({ reportType })
      expect(result.ok).toBe(true)
    }
  )

  it("refuses an unrecognised type instead of substituting the default", async () => {
    const { parseReportConfig, REPORT_TYPES } = await load()
    const result = parseReportConfig({ reportType: "research_report" })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("INVALID_REPORT_TYPE")
    // The refusal must name the closed set, or the caller has to guess.
    for (const type of REPORT_TYPES) expect(result.message).toContain(type)
  })

  it("refuses a missing type, and says it is missing rather than wrong", async () => {
    const { parseReportConfig } = await load()
    const result = parseReportConfig({ includeImages: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("INVALID_REPORT_TYPE")
    expect(result.message).toContain("required")
  })

  it("refuses an unknown key rather than dropping it", async () => {
    // Dropping is quieter and worse: the caller believes the option took effect.
    const { parseReportConfig } = await load()
    const result = parseReportConfig({ ...valid, includeEverything: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("INVALID_CONFIG")
    expect(result.message).toContain("includeEverything")
  })

  it("refuses a flag of the wrong type", async () => {
    const { parseReportConfig } = await load()
    const result = parseReportConfig({ reportType: "patient_report", includeImages: "yes" })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("INVALID_CONFIG")
    expect(result.message).toContain("includeImages")
  })

  it.each([[undefined], [null], ["diagnostic_summary"], [[]]])(
    "refuses %p — a config that is not an object states no type at all",
    async (config) => {
      const { parseReportConfig } = await load()
      const result = parseReportConfig(config)
      expect(result.ok).toBe(false)
    }
  )

  it("persists only declared fields, so an accepted config carries no extras", async () => {
    const { parseReportConfig } = await load()
    const result = parseReportConfig({ reportType: "patient_report" })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.config)).toEqual(["reportType"])
  })
})
