/**
 * T051 [US1] — FR-007, the return loop.
 *
 * Named assertion: after `more_data_requested → awaiting_review`, the case
 * reappears in the **claiming clinician's own list** and not the shared pool —
 * `getReviewQueue(claimer)` returns it and `getReviewQueue(otherClinician)` does
 * not.
 *
 * This suite carries its own stub rather than reusing `denials.test.ts`'s. That
 * one is built for refusals, so `update()` records the write and returns zero
 * rows — which is exactly right when the property under test is that nothing
 * happened, and useless here, where the property is what the queue reads back
 * **after** the write lands. The stub below applies updates to its tables so the
 * second read sees the first write.
 *
 * WHAT TRIGGERS THIS TRANSITION IS NOT SETTLED. Under spec A4 a case root is the
 * analysis row and no flow exists by which a patient adds data to an existing
 * one — a new upload is a new case. The task therefore says to build the
 * transition and prove it with an explicit state change, and **not** to invent a
 * patient-supplies-data flow. That gap is an owner decision, not an omission
 * here, and FR-007 is not honoured end to end until it is made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>
  type Term = { op: "eq" | "is"; column: string; value: unknown }
  type Filter = Term | { op: "or"; terms: Term[] } | { op: "not"; term: Term }

  const state = {
    tables: {} as Record<string, Row[]>,
    reset() {
      state.tables = {}
    },
  }

  const term = (row: Row, t: Term) =>
    t.op === "is" ? (row[t.column] ?? null) === t.value : row[t.column] === t.value

  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) => {
      if (f.op === "or") return f.terms.some((t) => term(row, t))
      if (f.op === "not") return !term(row, f.term)
      return term(row, f)
    })

  const parseOr = (expression: string): Term[] =>
    expression.split(",").map((clause) => {
      const [column, op, ...rest] = clause.split(".")
      const raw = rest.join(".")
      if (op !== "eq" && op !== "is") {
        throw new Error(`clinical-resume.test.ts stub: .or() operator "${op}" is not implemented.`)
      }
      return { op, column, value: raw === "null" ? null : raw }
    })

  const builder = (table: string) => {
    const filters: Filter[] = []
    let updated: Row[] | null = null

    const rows = () => (state.tables[table] ?? []).filter((r) => matches(r, filters))
    const result = () => ({ data: updated ?? rows(), error: null })

    const chain = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      eq(column: string, value: unknown) {
        filters.push({ op: "eq", column, value })
        return chain
      },
      is(column: string, value: unknown) {
        filters.push({ op: "is", column, value })
        return chain
      },
      or(expression: string) {
        filters.push({ op: "or", terms: parseOr(expression) })
        return chain
      },
      not(column: string, operator: string, value: unknown) {
        if (operator !== "is" && operator !== "eq") {
          throw new Error(`clinical-resume.test.ts stub: .not(${column}, ${operator}) unimplemented.`)
        }
        filters.push({ op: "not", term: { op: operator, column, value } })
        return chain
      },
      /**
       * Applies the patch in place and returns the rows it touched — the whole
       * reason this stub exists. Filters are evaluated BEFORE the patch, so the
       * compare-and-set predicate decides what is updated, exactly as the
       * database would.
       */
      update(payload: Row) {
        const touched = rows()
        for (const row of touched) Object.assign(row, payload)
        updated = touched
        return chain
      },
      single: async () => {
        const found = rows()
        return found.length === 1
          ? { data: found[0], error: null }
          : { data: null, error: { code: "PGRST116", message: "no rows" } }
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => resolve(result()),
    }
    return chain
  }

  return { state, client: { from: (table: string) => builder(table) } }
})

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }))

const { getReviewQueue, resumeReview } = await import("./clinical.server")

const CLAIMER = "user_clinician_a"
const OTHER = "user_clinician_b"

const waitingOnPatient = () => ({
  id: "case_1",
  user_id: "user_patient",
  review_state: "more_data_requested",
  claimed_by: CLAIMER,
  claimed_at: "2026-08-18T09:00:00.000Z",
  created_at: "2026-08-18T08:00:00.000Z",
  status: "completed",
  diagnosis: "melanoma",
})

const idsIn = async (userId: string) => {
  const queue = await getReviewQueue(userId)
  expect(queue.ok).toBe(true)
  return queue.ok ? queue.data.map((row) => row.id) : []
}

beforeEach(() => {
  db.state.reset()
})

describe("T051 — the return loop (FR-007)", () => {
  it("moves the case back to awaiting_review", async () => {
    db.state.tables.medical_analyses = [waitingOnPatient()]

    const resumed = await resumeReview("case_1", CLAIMER)

    expect(resumed.ok).toBe(true)
    expect(db.state.tables.medical_analyses[0].review_state).toBe("awaiting_review")
  })

  it("returns the case to the claiming clinician's own list, and to nobody else's", async () => {
    db.state.tables.medical_analyses = [waitingOnPatient()]

    await resumeReview("case_1", CLAIMER)

    // The named assertion, both halves.
    expect(await idsIn(CLAIMER)).toContain("case_1")
    expect(await idsIn(OTHER)).not.toContain("case_1")
  })

  it("keeps the claim — the case never returns to the shared pool (D5)", async () => {
    db.state.tables.medical_analyses = [waitingOnPatient()]

    await resumeReview("case_1", CLAIMER)

    // This is the single fact the assertion above rests on: `getReviewQueue`
    // admits a row when `claimed_by is null OR claimed_by = $user`, so clearing
    // the claim here would hand a half-finished review to whoever looked next.
    expect(db.state.tables.medical_analyses[0].claimed_by).toBe(CLAIMER)
  })

  it("refuses a clinician who does not hold the case, and changes nothing", async () => {
    db.state.tables.medical_analyses = [waitingOnPatient()]

    const resumed = await resumeReview("case_1", OTHER)

    // `not_found`, not a 403: a refusal that confirmed the id exists would leak
    // which cases are real to anyone who asked (FR-031).
    expect(resumed).toEqual({ ok: false, reason: "not_found" })
    expect(db.state.tables.medical_analyses[0].review_state).toBe("more_data_requested")
  })

  it("refuses from any state other than more_data_requested", async () => {
    for (const state of ["awaiting_review", "claimed", "decided", "signed", "released"]) {
      db.state.tables.medical_analyses = [{ ...waitingOnPatient(), review_state: state }]

      const resumed = await resumeReview("case_1", CLAIMER)

      expect(resumed, `from ${state}`).toEqual({ ok: false, reason: "invalid_transition" })
      expect(db.state.tables.medical_analyses[0].review_state, `from ${state}`).toBe(state)
    }
  })

  it("leaves a historical row out of every queue, before and after (FR-044)", async () => {
    db.state.tables.medical_analyses = [
      { ...waitingOnPatient(), id: "case_old", review_state: null, claimed_by: null },
    ]

    expect(await idsIn(CLAIMER)).not.toContain("case_old")
    expect(await resumeReview("case_old", CLAIMER)).toEqual({ ok: false, reason: "not_found" })
    expect(await idsIn(CLAIMER)).not.toContain("case_old")
  })
})
