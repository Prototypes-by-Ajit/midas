/**
 * T038-T040's own denial rows, BFF-side.
 *
 * `backend/tests/test_admin_denials.py` (T025) covers every FastAPI read route
 * but cannot reach these three — invite/role-change/offboard moved to Next.js
 * BFF route handlers because only Node can call Clerk (see
 * `lib/admin/governed-action.ts`'s module docstring for the architecture
 * decision). T041 named this gap explicitly: "would need a mocked-Clerk
 * vitest suite hitting the three route handlers directly." This is that
 * suite.
 *
 * Pattern follows `lib/clinical/denials.test.ts`: mock `server-only`,
 * `@clerk/nextjs/server`, and `@/lib/supabase/admin`; call the real route
 * handler; read the status and the audit trail off the response, never the
 * source. Role model is the current one — `UserRole = "patient" | "clinician"
 * | "admin"` (`contract.ts`'s `OPERATOR_ROLES = ["admin"]`); ml_engineer/sre
 * do not exist in code anymore, so they are not tested here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// --------------------------------------------------------------------------- //
// The caller's own session -- consumed by getSessionUser() via auth() + a
// clerkClient().users.getUser() lookup, same as denials.test.ts.
// --------------------------------------------------------------------------- //

const session = vi.hoisted(() => ({ userId: "user_caller" }))

// --------------------------------------------------------------------------- //
// A fake Clerk. One directory of {userId -> role} backs every users.getUser /
// getUserList call (including the caller's own, so the session's role and the
// directory never disagree), plus invitations and sessions stores for the
// invite/offboard domain calls.
// --------------------------------------------------------------------------- //

const clerk = vi.hoisted(() => {
  const state = {
    users: new Map<string, { role: string | null }>(),
    invitations: [] as { id: string; emailAddress: string }[],
    sessions: new Map<string, string[]>(),
    calls: [] as { method: string; args: unknown }[],
    reset() {
      state.users.clear()
      state.invitations = []
      state.sessions.clear()
      state.calls = []
    },
  }

  const record = (method: string, args: unknown) => state.calls.push({ method, args })
  const asUser = (id: string) => {
    const u = state.users.get(id)
    return { id, privateMetadata: {}, publicMetadata: { role: u?.role ?? null } }
  }

  const client = {
    users: {
      getUser: async (id: string) => {
        record("users.getUser", id)
        return asUser(id)
      },
      getUserList: async (params: unknown) => {
        record("users.getUserList", params)
        return { data: Array.from(state.users.keys()).map(asUser) }
      },
      updateUserMetadata: async (id: string, patch: { publicMetadata?: { role?: string | null } }) => {
        record("users.updateUserMetadata", { id, patch })
        const u = state.users.get(id) ?? { role: null }
        if (patch.publicMetadata && "role" in patch.publicMetadata) u.role = patch.publicMetadata.role ?? null
        state.users.set(id, u)
      },
    },
    invitations: {
      getInvitationList: async (params: unknown) => {
        record("invitations.getInvitationList", params)
        return { data: state.invitations }
      },
      createInvitation: async (params: { emailAddress: string }) => {
        record("invitations.createInvitation", params)
        const inv = { id: `inv_${state.invitations.length + 1}`, emailAddress: params.emailAddress }
        state.invitations.push(inv)
        return inv
      },
      revokeInvitation: async (id: string) => {
        record("invitations.revokeInvitation", id)
        state.invitations = state.invitations.filter((i) => i.id !== id)
      },
    },
    sessions: {
      getSessionList: async (params: { userId: string }) => {
        record("sessions.getSessionList", params)
        return { data: (state.sessions.get(params.userId) ?? []).map((id) => ({ id })) }
      },
      revokeSession: async (id: string) => {
        record("sessions.revokeSession", id)
      },
    },
  }

  return { state, client }
})

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId || null }),
  clerkClient: async () => clerk.client,
}))

// --------------------------------------------------------------------------- //
// A fake `audit_events` table plus `rpc()`, covering exactly the query shapes
// `admin.server.ts` issues: bare insert (role-denial write, last-admin-guard
// write), insert().select().single() (runGovernedAction's pending row),
// update().eq().eq() awaited directly (runGovernedAction's refused-finalize),
// and select().eq()×3.order().limit(1).maybeSingle() (invite's duplicate
// check). The three RPCs (invite_user / change_user_role / offboard_user)
// finalize the pending row to "allowed", mirroring what the real RPC does --
// `governed-action.test.ts`'s own fake does the same for the same reason.
// --------------------------------------------------------------------------- //

const db = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string }

  const state = {
    rows: [] as Row[],
    nextId: 1,
    reset() {
      state.rows = []
      state.nextId = 1
    },
  }

  function builder() {
    const filters: { col: string; val: unknown }[] = []
    let pending: Row[] | null = null
    let updatePayload: Record<string, unknown> | null = null

    const applyFilters = (rows: Row[]) => rows.filter((r) => filters.every((f) => r[f.col] === f.val))

    const chain = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq(col: string, val: unknown) {
        filters.push({ col, val })
        return chain
      },
      insert(payload: Record<string, unknown>) {
        const row = { id: `evt_${state.nextId++}`, ...payload } as Row
        state.rows.push(row)
        pending = [row]
        return chain
      },
      update(payload: Record<string, unknown>) {
        updatePayload = payload
        return chain
      },
      single: async () => {
        const rows = pending ?? applyFilters(state.rows)
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } }
      },
      maybeSingle: async () => {
        const rows = pending ?? applyFilters(state.rows)
        return { data: rows[0] ?? null, error: null }
      },
      // Thenable so `await supabase.from(...).update(...).eq(...).eq(...)` and
      // `await supabase.from(...).insert(...)` (no `.select()`) both resolve --
      // the two call shapes with no `.single()`/`.maybeSingle()` terminal.
      then(resolve: (v: { data: null; error: null }) => void) {
        if (updatePayload) {
          applyFilters(state.rows).forEach((r) => Object.assign(r, updatePayload))
        }
        resolve({ data: null, error: null })
      },
    }
    return chain
  }

  const client = {
    from: (table: string) => {
      if (table !== "audit_events") throw new Error(`unexpected table ${table}`)
      return builder()
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      const pendingEvtId = args.p_pending_evt_id as string
      const row = state.rows.find((r) => r.id === pendingEvtId)
      if (row) row.outcome = "allowed"
      return { data: [{ evt_id: pendingEvtId, outcome: "allowed" }], error: null }
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => db.client,
}))

// --------------------------------------------------------------------------- //
// Calling a route handler directly, as denials.test.ts does.
// --------------------------------------------------------------------------- //

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
interface RouteModule {
  POST?: RouteHandler
  PATCH?: RouteHandler
}

const INVITE = "@/app/api/admin/users/invite/route"
const ROLE = "@/app/api/admin/users/[id]/role/route"
const OFFBOARD = "@/app/api/admin/users/[id]/offboard/route"

async function call(
  specifier: string,
  method: "POST" | "PATCH",
  { as, params = {}, body }: { as: { role: string; userId: string }; params?: Record<string, string>; body?: unknown },
) {
  session.userId = as.userId
  clerk.state.users.set(as.userId, { role: as.role })

  const mod = (await import(specifier)) as RouteModule
  const handler = method === "POST" ? mod.POST : mod.PATCH
  if (!handler) throw new Error(`${specifier} exports no ${method} handler`)

  const request = new Request("http://localhost/api/admin/users/test", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  })
  const response = await handler(request, { params: Promise.resolve(params) })
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

const ADMIN = { role: "admin", userId: "user_admin_caller" }
const PATIENT = { role: "patient", userId: "user_patient_caller" }
const CLINICIAN = { role: "clinician", userId: "user_clinician_caller" }

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://stub.supabase.invalid")
  vi.stubEnv("SUPABASE_SERVICE_KEY", "service-key")
  clerk.state.reset()
  db.state.reset()
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// --------------------------------------------------------------------------- //
// 1. Role gate -- OPERATOR_ROLES is ["admin"] only. Every non-admin caller is
//    refused, on every one of the three routes, individually.
// --------------------------------------------------------------------------- //

describe("role gate", () => {
  it.each([
    ["patient", PATIENT],
    ["clinician", CLINICIAN],
  ])("refuses a %s inviting a user", async (_label, actor) => {
    const { status, payload } = await call(INVITE, "POST", {
      as: actor,
      body: { email: "new@example.invalid", role: "clinician", reason: "onboarding" },
    })

    expect(status).toBe(403)
    expect(payload.error_code).toBe("FORBIDDEN")
    expect(db.state.rows).toHaveLength(1)
    expect(db.state.rows[0]).toMatchObject({ action: "user.invite", outcome: "refused" })
    expect(clerk.state.calls.some((c) => c.method === "invitations.createInvitation")).toBe(false)
  })

  it.each([
    ["patient", PATIENT],
    ["clinician", CLINICIAN],
  ])("refuses a %s changing a role", async (_label, actor) => {
    const { status, payload } = await call(ROLE, "PATCH", {
      as: actor,
      params: { id: "user_target" },
      body: { role: "clinician", reason: "correction" },
    })

    expect(status).toBe(403)
    expect(payload.error_code).toBe("FORBIDDEN")
    expect(db.state.rows).toHaveLength(1)
    expect(db.state.rows[0]).toMatchObject({ action: "user.role_change", outcome: "refused" })
    expect(clerk.state.calls.some((c) => c.method === "users.updateUserMetadata")).toBe(false)
  })

  it.each([
    ["patient", PATIENT],
    ["clinician", CLINICIAN],
  ])("refuses a %s offboarding a user", async (_label, actor) => {
    const { status, payload } = await call(OFFBOARD, "POST", {
      as: actor,
      params: { id: "user_target" },
      body: { reason: "policy violation" },
    })

    expect(status).toBe(403)
    expect(payload.error_code).toBe("FORBIDDEN")
    expect(db.state.rows).toHaveLength(1)
    expect(db.state.rows[0]).toMatchObject({ action: "user.offboard", outcome: "refused" })
    expect(clerk.state.calls.some((c) => c.method === "sessions.revokeSession")).toBe(false)
  })
})

// --------------------------------------------------------------------------- //
// 2/3/4. Last-admin guard -- FR-USR-5. Fires with exactly one Admin left,
// stays out of the way with two.
// --------------------------------------------------------------------------- //

describe("last-admin guard", () => {
  it("refuses a role change away from admin when it would leave zero Admins", async () => {
    // The sole Admin acting on themselves: with only one Admin registered,
    // caller and target must be that same user -- there is no other request
    // shape that keeps the route's own admin-only gate satisfied while
    // countActiveAdmins() reads exactly 1.
    const { status, payload } = await call(ROLE, "PATCH", {
      as: ADMIN,
      params: { id: ADMIN.userId },
      body: { role: "clinician", reason: "reassignment" },
    })

    expect(status).toBe(409)
    expect(payload.error_code).toBe("LAST_ADMIN_GUARD")
    expect(clerk.state.calls.some((c) => c.method === "users.updateUserMetadata")).toBe(false)
  })

  it("refuses offboarding the last Admin", async () => {
    const { status, payload } = await call(OFFBOARD, "POST", {
      as: ADMIN,
      params: { id: ADMIN.userId },
      body: { reason: "departure" },
    })

    expect(status).toBe(409)
    expect(payload.error_code).toBe("LAST_ADMIN_GUARD")
    expect(clerk.state.calls.some((c) => c.method === "sessions.revokeSession")).toBe(false)
    expect(clerk.state.calls.some((c) => c.method === "users.updateUserMetadata")).toBe(false)
  })

  it("does not fire a role change away from admin when two Admins exist", async () => {
    clerk.state.users.set("user_target", { role: "admin" }) // the second Admin, besides the caller

    const { status, payload } = await call(ROLE, "PATCH", {
      as: ADMIN,
      params: { id: "user_target" },
      body: { role: "clinician", reason: "reassignment" },
    })

    expect(status).not.toBe(409)
    expect(payload.error_code).not.toBe("LAST_ADMIN_GUARD")
  })

  it("does not fire offboarding an Admin when two Admins exist", async () => {
    clerk.state.users.set("user_target", { role: "admin" })

    const { status, payload } = await call(OFFBOARD, "POST", {
      as: ADMIN,
      params: { id: "user_target" },
      body: { reason: "departure" },
    })

    expect(status).not.toBe(409)
    expect(payload.error_code).not.toBe("LAST_ADMIN_GUARD")
  })
})

// --------------------------------------------------------------------------- //
// 5. Empty reason -- refused before any Clerk call, same guard
// runGovernedAction's own Python original (admin.py) and TypeScript port
// share.
// --------------------------------------------------------------------------- //

describe("empty reason", () => {
  it("refuses an invite with no reason before calling Clerk", async () => {
    const { status, payload } = await call(INVITE, "POST", {
      as: ADMIN,
      body: { email: "new@example.invalid", role: "clinician", reason: "   " },
    })

    expect(status).toBe(400)
    expect(payload.error_code).toBe("EMPTY_REASON")
    expect(clerk.state.calls.some((c) => c.method === "invitations.createInvitation")).toBe(false)
  })
})

// --------------------------------------------------------------------------- //
// 6. Identical retry -- a second invite to a still-pending email is a
// "duplicate", not a second Clerk invitation (R10 §5).
// --------------------------------------------------------------------------- //

describe("identical retry", () => {
  it("returns duplicate on a second invite to the same pending email, no second Clerk call", async () => {
    const body = { email: "repeat@example.invalid", role: "clinician", reason: "onboarding" }

    const first = await call(INVITE, "POST", { as: ADMIN, body })
    expect(first.status).toBe(200)
    expect(first.payload.outcome).toBe("allowed")

    const second = await call(INVITE, "POST", { as: ADMIN, body })
    expect(second.status).toBe(200)
    expect(second.payload.outcome).toBe("duplicate")

    const createCalls = clerk.state.calls.filter((c) => c.method === "invitations.createInvitation")
    expect(createCalls).toHaveLength(1)
  })
})
