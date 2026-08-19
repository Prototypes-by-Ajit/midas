/**
 * T014-T023 [US2] -- who may not do what, asserted as an HTTP status.
 *
 * Every test here issues a request directly at a route handler and reads the
 * status off the response. None of them looks at the interface. FR-034 is the
 * reason: a hidden button is a display decision, and a test asserting one proves
 * only that the display decided something. The control is server-side or it does
 * not exist, so the test has to be able to see the server say no.
 *
 * WHY THIS FILE IS IN lib/ AND NOT UNDER app/ (review note E3). The contract
 * document places it at `app/api/clinical/__tests__/denials.test.ts`. That path
 * was excluded from `tsconfig.json` twice over -- once by `**\/__tests__\/**` and
 * once by `**\/*.test.ts` -- which would have left thirteen tests guarding who may
 * sign a medical report with no compile-time checking at all. T002 removed the
 * `*.test.ts` exclusion; this file also moves out of `__tests__/` so neither rule
 * can reach it again. `vitest.config.ts` collects `src/**\/*.test.ts`, so it runs
 * from here unchanged.
 *
 * WHAT "PASSING" MEANS BEFORE PHASE 5. Every test below must fail, and fail
 * because the route module does not exist yet -- not because an assertion is
 * malformed. That is Checkpoint C3. Each route is loaded inside the test that
 * needs it, following `lib/reports/orchestration.test.ts`, so a missing module
 * fails one test rather than collapsing the file into a single collection error.
 *
 * SCOPE. All ten tasks T014-T023 are written, so this file satisfies Checkpoint
 * C3. Twelve tests, thirteen contract rows: T017 and T021 each answer two
 * requests, and rows 4 and 5 (unsigned, signed-but-unreleased) share T018 as the
 * task specifies -- the second is the one a signature-gated implementation gets
 * wrong, so they are asserted together against the same handler.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --------------------------------------------------------------------------- //
// Mocks. `vi.mock` factories are hoisted above the imports, so anything they
// close over has to be hoisted with them.
// --------------------------------------------------------------------------- //

/**
 * `services/auth.server.ts` and `lib/supabase/admin.ts` both open with
 * `import "server-only"`, whose default export throws outside a React Server
 * Component. The `react-server` export condition is what normally selects the
 * empty build, and vitest's node environment does not set it.
 */
vi.mock("server-only", () => ({}))

const session = vi.hoisted(() => ({
  userId: "user_2unset",
  role: "patient" as "patient" | "clinician" | "admin",
}))

/**
 * Clerk, as `getSessionUser()` actually consumes it: `auth()` for the subject id,
 * then `clerkClient().users.getUser()` for the role. Role is read from the user
 * record and from nowhere else -- which is the property T023 will attack.
 */
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId || null }),
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => ({
        id,
        privateMetadata: { role: session.role },
        publicMetadata: {},
        firstName: "Test",
        fullName: "Test Person",
        primaryEmailAddress: { emailAddress: "test@example.invalid" },
      }),
    },
  }),
}))

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>
  type Term = { op: "eq" | "is"; column: string; value: unknown }
  type Filter = Term | { op: "or"; terms: Term[] } | { op: "not"; term: Term }

  const state = {
    /** Table name -> rows the stub will serve. Set per test. */
    tables: {} as Record<string, Row[]>,
    /** Every mutating call the handler made. A denial must leave this empty. */
    writes: [] as { table: string; op: string; payload: unknown }[],
    reset() {
      state.tables = {}
      state.writes = []
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

  /**
   * PostgREST's `or=` grammar, for the one form contract §5 uses:
   * `column.op.value,column.op.value`. `null` is the literal string in that
   * grammar, so `claimed_by.is.null` has to become a comparison against `null`
   * and not against `"null"` -- the difference between a predicate that scopes
   * and one that matches nothing, which would make T017 pass for the wrong
   * reason.
   */
  const parseOr = (expression: string): Term[] =>
    expression.split(",").map((clause) => {
      const [column, op, ...rest] = clause.split(".")
      const raw = rest.join(".")
      if (op !== "eq" && op !== "is") {
        throw new Error(`denials.test.ts stub: .or() operator "${op}" is not implemented.`)
      }
      return { op, column, value: raw === "null" ? null : raw }
    })

  /**
   * Enough of the PostgREST builder for the reads and writes this slice makes,
   * and no more.
   *
   * `.or()` and `.not()` were left throwing by T014, on the grounds that a
   * filter which silently passes everything through is how a scoping test goes
   * green while scoping nothing -- the failure E7 names, where the test proves
   * the stub. T026 is the first task that needs them: `getCaseForClinician`
   * scopes with `.or(claimed_by.is.null,claimed_by.eq.<me>)` and the queue read
   * excludes historical rows with `.not("review_state", "is", null)`. They are
   * implemented here rather than stubbed permissively, and both are checked --
   * T017 fails if `.or()` returns a case held by another clinician.
   */
  const builder = (table: string) => {
    const filters: Filter[] = []
    let pending: Row[] | null = null

    const rows = () => (pending ?? state.tables[table] ?? []).filter((r) => matches(r, filters))
    const result = () => ({ data: rows(), error: null })

    const chain = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
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
          throw new Error(
            `denials.test.ts stub: .not(${column}, ${operator}) is not implemented. ` +
              `Implement the predicate rather than letting the query return every row.`,
          )
        }
        filters.push({ op: "not", term: { op: operator, column, value } })
        return chain
      },
      insert(payload: unknown) {
        state.writes.push({ table, op: "insert", payload })
        pending = []
        return chain
      },
      update(payload: unknown) {
        state.writes.push({ table, op: "update", payload })
        pending = []
        return chain
      },
      single: async () => {
        const found = rows()
        return found.length === 1
          ? { data: found[0], error: null }
          : { data: null, error: { code: "PGRST116", message: "no rows" } }
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      // Thenable, so `await supabase.from(...).select(...).eq(...)` resolves.
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => resolve(result()),
    }
    return chain
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      state.writes.push({ table: `rpc:${name}`, op: "rpc", payload: args })
      return { data: null, error: null }
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => db.client,
}))

// --------------------------------------------------------------------------- //
// Calling a route handler as a named role
// --------------------------------------------------------------------------- //

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>

interface RouteModule {
  GET?: RouteHandler
  POST?: RouteHandler
}

/**
 * The specifier is a variable on purpose. A literal `import("@/app/...")` is a
 * TypeScript module reference, so `npx tsc --noEmit` would report TS2307 for
 * every route Phase 5 has not written yet -- turning the typecheck gate red for
 * the entire time these tests are meant to be red. A variable specifier defers
 * resolution to the runtime, which is exactly where "the module does not exist"
 * belongs.
 *
 * Before the module exists the failure reads `Cannot find package '@/app/...'`.
 * That wording is the resolver falling back to a bare-package lookup after the
 * alias target turns up missing -- it is not a broken alias, and it does not need
 * fixing. Verified: the same variable specifier resolves an aliased module that
 * does exist.
 */
const loadRoute = (specifier: string): Promise<RouteModule> =>
  import(specifier) as Promise<RouteModule>

interface CallOptions {
  as: { role: "patient" | "clinician" | "admin"; userId: string }
  method?: "GET" | "POST"
  params?: Record<string, string>
  body?: unknown
}

/** Issue one request at one handler and report what the server actually said. */
async function callRoute(
  specifier: string,
  { as, method = "POST", params = {}, body }: CallOptions,
): Promise<{ status: number; payload: unknown }> {
  session.userId = as.userId
  session.role = as.role

  const mod = await loadRoute(specifier)
  const handler = method === "GET" ? mod.GET : mod.POST
  if (!handler) throw new Error(`${specifier} exports no ${method} handler`)

  const request = new Request("http://localhost/api/clinical/test", {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  })

  const response = await handler(request, { params: Promise.resolve(params) })
  const text = await response.text()
  return {
    status: response.status,
    payload: text === "" ? null : JSON.parse(text),
  }
}

/** Every key anywhere in a payload. `content` must be absent, not null (T018). */
function collectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, found))
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      found.add(key)
      collectKeys(nested, found)
    }
  }
  return found
}

const SIGN = "@/app/api/clinical/versions/[id]/sign/route"
const RELEASE = "@/app/api/clinical/versions/[id]/release/route"
const REVIEW = "@/app/api/clinical/cases/[id]/review/route"
const CASE = "@/app/api/clinical/cases/[id]/route"
const QUEUE = "@/app/api/clinical/queue/route"

const PATIENT = { role: "patient", userId: "user_2patientOwner" } as const
const OTHER_PATIENT = { role: "patient", userId: "user_2patientStranger" } as const
const CLINICIAN = { role: "clinician", userId: "user_2clinicianCaller" } as const
const OTHER_CLINICIAN = { role: "clinician", userId: "user_2clinicianHolder" } as const
const ADMIN = { role: "admin", userId: "user_2adminOperator" } as const

const CASE_ID = "11111111-1111-4111-8111-111111111111"
const VERSION_ID = "44444444-4444-4444-8444-444444444444"
const ABSENT_ID = "00000000-0000-4000-8000-000000000000"

/**
 * T031 (D6, FR-061): every refusal emits one structured line. The tests below
 * assert the line was written, because a control that refuses silently leaves no
 * way to answer "who tried to sign this?" — which is the question FR-061 exists
 * for, and the reason D6 could refuse an `access_events` table without losing it.
 *
 * `auditLines()` parses only the JSON objects tagged `clinical.audit`, so an
 * unrelated `console.log` or an existing `console.error` cannot satisfy an
 * assertion by accident.
 */
let logSpy: ReturnType<typeof vi.spyOn>

function auditLines(): Record<string, unknown>[] {
  const calls = logSpy.mock.calls as unknown as unknown[][]
  return calls
    .map((call): Record<string, unknown> | null => {
      const [first] = call
      if (typeof first !== "string") return null
      try {
        const parsed = JSON.parse(first) as Record<string, unknown>
        return parsed?.event === "clinical.audit" ? parsed : null
      } catch {
        return null
      }
    })
    .filter((line): line is Record<string, unknown> => line !== null)
}

/** The one refusal line this request should have produced. */
function expectRefusal(actor: string, action: string, code: string) {
  const refusals = auditLines().filter((l) => l.outcome === "refused")
  expect(refusals).toHaveLength(1)
  expect(refusals[0]).toMatchObject({ actor, action, outcome: "refused", code })
  // Never the content that was refused (D6). The note and the diagnosis are the
  // two things a clinical refusal is most likely to leak into a log.
  const serialised = JSON.stringify(refusals[0])
  expect(serialised).not.toMatch(/note|diagnosis|melanoma|content/i)
}

beforeEach(() => {
  db.state.reset()
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

// --------------------------------------------------------------------------- //
// T015 / T016 -- signing is a clinician act, and there is no privileged path
// --------------------------------------------------------------------------- //

describe("signing", () => {
  it("T015 refuses a patient with 403 and writes no signature", async () => {
    db.state.tables.report_versions = [
      { id: VERSION_ID, report_id: "r1", version_number: 1, signed_at: null, signed_by: null },
    ]

    const { status } = await callRoute(SIGN, { as: PATIENT, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    // The status alone would pass against a handler that refused *after* writing.
    expect(db.state.writes).toEqual([])
    expectRefusal(PATIENT.userId, "version.sign", "FORBIDDEN")
  })

  it("T016 refuses an admin with 403 — admin is not a senior clinician", async () => {
    db.state.tables.report_versions = [
      { id: VERSION_ID, report_id: "r1", version_number: 1, signed_at: null, signed_by: null },
    ]

    const { status } = await callRoute(SIGN, { as: ADMIN, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    expectRefusal(ADMIN.userId, "version.sign", "FORBIDDEN")
  })
})

// --------------------------------------------------------------------------- //
// T017 -- a case held by another clinician is indistinguishable from no case
// --------------------------------------------------------------------------- //

describe("cross-clinician isolation", () => {
  it("T017 answers a foreign claim and an absent id identically (FR-031)", async () => {
    db.state.tables.medical_analyses = [
      {
        id: CASE_ID,
        user_id: PATIENT.userId,
        review_state: "claimed",
        claimed_by: OTHER_CLINICIAN.userId,
        claimed_at: "2026-08-17T10:00:00.000Z",
        created_at: "2026-08-17T09:00:00.000Z",
      },
    ]

    const refused = await callRoute(CASE, {
      as: CLINICIAN,
      method: "GET",
      params: { id: CASE_ID },
    })
    const absent = await callRoute(CASE, {
      as: CLINICIAN,
      method: "GET",
      params: { id: ABSENT_ID },
    })

    expect(refused.status).toBe(404)
    expect(absent.status).toBe(404)
    // FR-031 fails if these differ. A 403 here, or a message naming the holder,
    // lets a caller enumerate which case ids exist and who is working them.
    expect(refused.payload).toEqual(absent.payload)
  })
})

// --------------------------------------------------------------------------- //
// T018 -- release is the patient-visibility gate, not signature
// --------------------------------------------------------------------------- //

describe("patient projection", () => {
  const patientCase = (versions: Record<string, unknown>[]) => {
    db.state.tables.medical_analyses = [
      {
        id: CASE_ID,
        user_id: PATIENT.userId,
        review_state: "signed",
        created_at: "2026-08-17T09:00:00.000Z",
      },
    ]
    db.state.tables.report_versions = versions
  }

  it("T018 withholds an unsigned version and a signed-but-unreleased one", async () => {
    // Case one: drafted, never signed.
    patientCase([
      {
        id: VERSION_ID,
        report_id: "r1",
        version_number: 1,
        state: "draft",
        content: { summary: "must not reach the patient" },
        signed_at: null,
        released_at: null,
      },
    ])
    const unsigned = await callRoute(CASE, {
      as: PATIENT,
      method: "GET",
      params: { id: CASE_ID },
    })

    expect(unsigned.status).toBe(200)
    // "no `content` key at all, not a null one" — a null key still tells the
    // patient a document exists, and serialises into the page.
    expect(collectKeys(unsigned.payload).has("content")).toBe(false)

    // Case two: signed, and deliberately not released. This is the one a
    // signature-gated implementation gets wrong.
    db.state.reset()
    patientCase([
      {
        id: VERSION_ID,
        report_id: "r1",
        version_number: 1,
        state: "signed",
        content: { summary: "signed but not released" },
        signed_by: OTHER_CLINICIAN.userId,
        signed_at: "2026-08-17T11:00:00.000Z",
        released_at: null,
      },
    ])
    const unreleased = await callRoute(CASE, {
      as: PATIENT,
      method: "GET",
      params: { id: CASE_ID },
    })

    expect(unreleased.status).toBe(200)
    expect(collectKeys(unreleased.payload).has("content")).toBe(false)
  })
})

// --------------------------------------------------------------------------- //
// T019 / T020 -- the write surface and the work list are clinician-only
// --------------------------------------------------------------------------- //

describe("clinical authority", () => {
  const caseHeldByAnother = () => {
    db.state.tables.medical_analyses = [
      {
        id: CASE_ID,
        user_id: PATIENT.userId,
        review_state: "claimed",
        claimed_by: OTHER_CLINICIAN.userId,
        created_at: "2026-08-17T09:00:00.000Z",
      },
    ]
    db.state.tables.report_versions = [
      {
        id: VERSION_ID,
        report_id: "r1",
        version_number: 1,
        state: "signed",
        signed_by: OTHER_CLINICIAN.userId,
        signed_at: "2026-08-17T11:00:00.000Z",
        released_at: null,
      },
    ]
  }

  it("T019 refuses a patient recording a decision (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(REVIEW, {
      as: PATIENT,
      params: { id: CASE_ID },
      body: { outcome: "decision_recorded", note: "I would like this signed off." },
    })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    expectRefusal(PATIENT.userId, "case.review", "FORBIDDEN")
  })

  it("T019 refuses a patient releasing a version (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(RELEASE, { as: PATIENT, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    expectRefusal(PATIENT.userId, "version.release", "FORBIDDEN")
  })

  it("T019 refuses a patient opening the work list (403)", async () => {
    // The check must precede the query. A handler that queries first and refuses
    // afterwards has already read every unclaimed case in the system.
    const { status } = await callRoute(QUEUE, { as: OTHER_PATIENT, method: "GET" })

    expect(status).toBe(403)
    expectRefusal(OTHER_PATIENT.userId, "queue.read", "FORBIDDEN")
  })

  it("T020 refuses an admin recording a decision (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(REVIEW, {
      as: ADMIN,
      params: { id: CASE_ID },
      body: { outcome: "decision_recorded", note: "Signing off on behalf of the clinician." },
    })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    expectRefusal(ADMIN.userId, "case.review", "FORBIDDEN")
  })

  it("T020 refuses an admin releasing a version (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(RELEASE, { as: ADMIN, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    expectRefusal(ADMIN.userId, "version.release", "FORBIDDEN")
  })
})

// --------------------------------------------------------------------------- //
// T021 -- a case belonging to another patient is indistinguishable from no case
// --------------------------------------------------------------------------- //

describe("cross-patient isolation", () => {
  it("T021 answers another patient's case and an absent id identically (FR-031)", async () => {
    db.state.tables.medical_analyses = [
      {
        id: CASE_ID,
        user_id: PATIENT.userId,
        review_state: "released",
        created_at: "2026-08-17T09:00:00.000Z",
      },
    ]

    // OTHER_PATIENT is authenticated and is not the owner. The refusal must not
    // reveal that the id resolves to something -- same reasoning as T017, one
    // role over: 404 for absent and 404 for not-yours, byte-identical.
    const refused = await callRoute(CASE, {
      as: OTHER_PATIENT,
      method: "GET",
      params: { id: CASE_ID },
    })
    const absent = await callRoute(CASE, {
      as: OTHER_PATIENT,
      method: "GET",
      params: { id: ABSENT_ID },
    })

    expect(refused.status).toBe(404)
    expect(absent.status).toBe(404)
    expect(refused.payload).toEqual(absent.payload)
  })
})

// --------------------------------------------------------------------------- //
// T022 -- admin authority is operational, and stops at the clinical boundary
// --------------------------------------------------------------------------- //

describe("admin projection", () => {
  it("T022 gives an admin the operational projection and no clinical content (FR-062)", async () => {
    // Every field the admin must not receive is present on the fixture row, so
    // the assertion fails against a `select("*")` rather than passing because
    // the test data happened to be thin.
    db.state.tables.medical_analyses = [
      {
        id: CASE_ID,
        user_id: PATIENT.userId,
        review_state: "released",
        created_at: "2026-08-17T09:00:00.000Z",
        updated_at: "2026-08-17T12:00:00.000Z",
        processing_time: 1420,
        status: "completed",
        error_message: null,
        claimed_by: CLINICIAN.userId,
        claimed_at: "2026-08-17T10:00:00.000Z",
        image_url: "https://storage.invalid/lesion.jpg",
        image_name: "lesion.jpg",
        diagnosis: "melanoma",
        confidence: 0.91,
        risk_level: "high",
        classification_metrics: { melanoma: 0.91 },
      },
    ]
    db.state.tables.case_reviews = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        analysis_id: CASE_ID,
        clinician_id: CLINICIAN.userId,
        outcome: "decision_recorded",
        note: "clinical free text the admin must not read",
        created_at: "2026-08-17T10:30:00.000Z",
      },
    ]
    db.state.tables.generated_reports = [
      { id: "r1", analysis_id: CASE_ID, user_id: PATIENT.userId },
    ]
    db.state.tables.report_versions = [
      {
        id: VERSION_ID,
        report_id: "r1",
        version_number: 1,
        state: "signed",
        content: { summary: "clinical content the admin must not read" },
        signed_by: CLINICIAN.userId,
        signed_at: "2026-08-17T11:00:00.000Z",
        released_by: CLINICIAN.userId,
        released_at: "2026-08-17T12:00:00.000Z",
      },
    ]

    const { status, payload } = await callRoute(CASE, {
      as: ADMIN,
      method: "GET",
      params: { id: CASE_ID },
    })

    expect(status).toBe(200)

    // The operational half is present -- an admin who can see nothing cannot
    // answer "is this case stuck?", which is the whole point of the view.
    expect(payload).toMatchObject({ id: CASE_ID, exists: true, review_state: "released" })

    // ...and the clinical half is absent. Recursive, so a nested `evidence` or
    // `versions` object cannot smuggle a field past a top-level check.
    const keys = collectKeys(payload)
    for (const forbidden of ["image_url", "diagnosis", "confidence", "risk_level", "content"]) {
      expect(keys.has(forbidden)).toBe(false)
    }
    // `note` is the clinical free text on case_reviews. Attribution is
    // operational; what the clinician wrote is not.
    expect(keys.has("note")).toBe(false)
  })
})

// --------------------------------------------------------------------------- //
// T023 -- role comes from the session, never from the caller
// --------------------------------------------------------------------------- //

describe("forged role", () => {
  it("T023 ignores a role claimed in the request body (FR-032)", async () => {
    db.state.tables.report_versions = [
      { id: VERSION_ID, report_id: "r1", version_number: 1, signed_at: null, signed_by: null },
    ]

    // Authenticated as a patient, asking to be treated as a clinician. The body
    // is well-formed and the intent is plausible -- which is the point: the
    // refusal must come from `getSessionUser()` disagreeing, not from the
    // request failing to parse.
    const { status } = await callRoute(SIGN, {
      as: PATIENT,
      params: { id: VERSION_ID },
      body: { role: "clinician", clinician_id: CLINICIAN.userId },
    })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
    // The line records the role the SESSION carried, never the one the body
    // claimed — the log has to agree with the check, or an audit trail would
    // report a clinician attempted this.
    expectRefusal(PATIENT.userId, "version.sign", "FORBIDDEN")
    expect(auditLines()[0]).toMatchObject({ actor_role: "patient" })
  })
})
