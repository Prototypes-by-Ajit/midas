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
 * SCOPE OF THIS RUN. T014-T020 only. T021 (patient reads another patient's
 * case), T022 (admin operational projection) and T023 (forged role) are not
 * written yet, so Checkpoint C3 is NOT satisfied by this file as it stands.
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
  type Filter = { op: "eq" | "is"; column: string; value: unknown }

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

  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) =>
      f.op === "is" ? (row[f.column] ?? null) === f.value : row[f.column] === f.value,
    )

  /**
   * Enough of the PostgREST builder for the reads and writes this slice makes,
   * and no more.
   *
   * `.or()` and `.not()` deliberately THROW rather than returning unfiltered
   * rows. An unimplemented filter that silently passes everything through is how
   * a scoping test goes green while scoping nothing -- the failure mode E7 warns
   * about, where the test proves the stub. Whoever writes the first test that
   * needs them extends this and can see that they did.
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
      or(expression: string): never {
        throw new Error(
          `denials.test.ts stub: .or(${expression}) on "${table}" is not implemented. ` +
            `Implement the predicate rather than letting the query return every row.`,
        )
      },
      not(column: string): never {
        throw new Error(
          `denials.test.ts stub: .not(${column}) on "${table}" is not implemented. ` +
            `Implement the predicate rather than letting the query return every row.`,
        )
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

beforeEach(() => db.state.reset())
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
  })

  it("T016 refuses an admin with 403 — admin is not a senior clinician", async () => {
    db.state.tables.report_versions = [
      { id: VERSION_ID, report_id: "r1", version_number: 1, signed_at: null, signed_by: null },
    ]

    const { status } = await callRoute(SIGN, { as: ADMIN, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
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
  })

  it("T019 refuses a patient releasing a version (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(RELEASE, { as: PATIENT, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
  })

  it("T019 refuses a patient opening the work list (403)", async () => {
    // The check must precede the query. A handler that queries first and refuses
    // afterwards has already read every unclaimed case in the system.
    const { status } = await callRoute(QUEUE, { as: OTHER_PATIENT, method: "GET" })

    expect(status).toBe(403)
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
  })

  it("T020 refuses an admin releasing a version (403)", async () => {
    caseHeldByAnother()
    const { status } = await callRoute(RELEASE, { as: ADMIN, params: { id: VERSION_ID } })

    expect(status).toBe(403)
    expect(db.state.writes).toEqual([])
  })
})
