/**
 * T041 [US5] — the one sanctioned non-additive edit, asserted as behaviour.
 *
 * Done when: a patient-identity generate request on a case in review is refused,
 * and analyses that never entered review are untouched. Both halves are checked
 * here by driving the real handler, not by reading its source.
 *
 * This suite mocks `@supabase/supabase-js` rather than `@/lib/supabase/admin`,
 * because this handler predates that helper and calls `createClient()` itself —
 * so `denials.test.ts`'s stub does not reach it. The mock is deliberately small:
 * it serves one analysis row and records every write, so "refused" can be shown
 * to mean *nothing happened*, not merely *a non-200 came back*.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({ userId: "user_patient" }))

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId || null }),
}))

const db = vi.hoisted(() => {
  const state = {
    analysis: null as Record<string, unknown> | null,
    /** Every mutating call. A refusal must leave this empty. */
    writes: [] as { table: string; op: string }[],
  }

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      select: self,
      eq: self,
      order: self,
      single: async () =>
        state.analysis
          ? { data: state.analysis, error: null }
          : { data: null, error: { message: "not found" } },
      maybeSingle: async () =>
        state.analysis ? { data: state.analysis, error: null } : { data: null, error: null },
      insert: () => {
        state.writes.push({ table, op: "insert" })
        return chain
      },
      update: () => {
        state.writes.push({ table, op: "update" })
        return chain
      },
      delete: () => {
        state.writes.push({ table, op: "delete" })
        return chain
      },
    })
    return chain
  }

  return {
    state,
    client: {
      from: (table: string) => builder(table),
      rpc: async () => ({ data: "RPT-000001", error: null }),
      storage: {
        from: () => ({
          upload: async () => {
            state.writes.push({ table: "storage", op: "upload" })
            return { error: null }
          },
          createSignedUrl: async () => ({ data: { signedUrl: "https://example.invalid/x" } }),
        }),
      },
    },
  }
})

vi.mock("@supabase/supabase-js", () => ({ createClient: () => db.client }))

const VALID_BODY = {
  analysis_id: "a1",
  config: { reportType: "diagnostic_summary" },
}

async function post(body: unknown) {
  const { POST } = await import("./route")
  return POST(
    new Request("http://localhost/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
  )
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://stub.supabase.invalid")
  vi.stubEnv("SUPABASE_SERVICE_KEY", "service-key")
  vi.stubEnv("BACKEND_URL", "http://localhost:8000")
  session.userId = "user_patient"
  db.state.analysis = null
  db.state.writes = []
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** The columns the handler reads before it reaches the D4 guard. */
const analysisRow = (review_state: string | null) => ({
  id: "a1",
  user_id: "user_patient",
  diagnosis: "melanoma",
  confidence: 0.9,
  risk_level: "high",
  review_state,
})

describe("T041 — a case under clinical review is the clinician's to report on (D4)", () => {
  it("refuses a patient generating a report on a case in review", async () => {
    db.state.analysis = analysisRow("claimed")

    const response = await post(VALID_BODY)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error?.code ?? body.code).toBe("CASE_IN_REVIEW")
  })

  it("writes nothing when it refuses — no report row, no stored document", async () => {
    db.state.analysis = analysisRow("decided")

    await post(VALID_BODY)

    expect(db.state.writes).toEqual([])
  })

  it("refuses from every review state, not only the one it was written against", async () => {
    for (const state of [
      "awaiting_review",
      "claimed",
      "more_data_requested",
      "decided",
      "signed",
      "released",
    ]) {
      db.state.analysis = analysisRow(state)
      db.state.writes = []
      vi.resetModules()

      const response = await post(VALID_BODY)
      expect(response.status, `review_state=${state}`).toBe(409)
      expect(db.state.writes, `review_state=${state}`).toEqual([])
    }
  })

  it("leaves an analysis that never entered review untouched", async () => {
    // The other half of the done-when. NULL means the row predates this feature
    // (contract §1); the guard must not fire, so the handler proceeds past it.
    // It fails later for an unrelated reason — there is no live backend here —
    // and that is the point: the refusal it returns is NOT the D4 one.
    db.state.analysis = analysisRow(null)

    const response = await post(VALID_BODY)
    const body = await response.json()

    expect(response.status).not.toBe(409)
    expect(JSON.stringify(body)).not.toContain("CASE_IN_REVIEW")
  })

  it("still refuses someone else's analysis before it ever reaches the review guard", async () => {
    // Ownership is checked first and stays first: a stranger must not be able to
    // learn a case's review state from which refusal they get back.
    db.state.analysis = { ...analysisRow("claimed"), user_id: "user_someone_else" }

    const response = await post(VALID_BODY)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(JSON.stringify(body)).not.toContain("CASE_IN_REVIEW")
  })
})
