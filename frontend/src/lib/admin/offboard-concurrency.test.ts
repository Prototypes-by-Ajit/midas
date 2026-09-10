/**
 * T067 — two concurrent offboard requests racing the last-admin guard when
 * exactly 2 Admins remain (FR-USR-5). Eng review Tension 1's accepted
 * decision: no lock. This suite proves the race is real (calls `offboardUser`
 * directly, matching `backend/test_admin_concurrency.py`'s T066 precedent of
 * testing the function rather than the route) and that the guard's warning
 * log still fires whenever it does refuse. It does NOT attempt to close the
 * race — that would contradict the accepted decision this task verifies.
 *
 * Mock shape copied from `user-actions-denials.test.ts`, trimmed to what
 * `offboardUser` actually calls (no invitations mock — offboard never touches
 * Clerk invitations).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const clerk = vi.hoisted(() => {
  const state = {
    users: new Map<string, { role: string | null }>(),
    sessions: new Map<string, string[]>(),
    reset() {
      state.users.clear()
      state.sessions.clear()
    },
  }

  const asUser = (id: string) => {
    const u = state.users.get(id)
    return { id, privateMetadata: {}, publicMetadata: { role: u?.role ?? null } }
  }

  const client = {
    users: {
      getUser: async (id: string) => asUser(id),
      getUserList: async () => ({ data: Array.from(state.users.keys()).map(asUser) }),
      updateUserMetadata: async (id: string, patch: { publicMetadata?: { role?: string | null } }) => {
        const u = state.users.get(id) ?? { role: null }
        if (patch.publicMetadata && "role" in patch.publicMetadata) u.role = patch.publicMetadata.role ?? null
        state.users.set(id, u)
      },
    },
    sessions: {
      getSessionList: async (params: { userId: string }) => ({
        data: (state.sessions.get(params.userId) ?? []).map((id) => ({ id })),
      }),
      revokeSession: async () => {},
    },
  }

  return { state, client }
})

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => clerk.client,
}))

// Same `audit_events` fake as user-actions-denials.test.ts -- see that file
// for the query-shape rationale (bare insert, insert().select().single(),
// update().eq().eq() awaited directly).
const db = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string }
  const state = { rows: [] as Row[], nextId: 1 }

  function builder() {
    const filters: { col: string; val: unknown }[] = []
    let pending: Row[] | null = null
    let updatePayload: Record<string, unknown> | null = null
    const applyFilters = (rows: Row[]) => rows.filter((r) => filters.every((f) => r[f.col] === f.val))

    const chain = {
      select: () => chain,
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
      then(resolve: (v: { data: null; error: null }) => void) {
        if (updatePayload) applyFilters(state.rows).forEach((r) => Object.assign(r, updatePayload))
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
    rpc: async (_name: string, args: Record<string, unknown>) => {
      const row = state.rows.find((r) => r.id === args.p_pending_evt_id)
      if (row) row.outcome = "allowed"
      return { data: [{ evt_id: args.p_pending_evt_id, outcome: "allowed" }], error: null }
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }))

const actor = { id: "actor_1", role: "admin" }

/** Every `admin_count_guard_check` warning line logged so far. */
function guardWarnings(): string[] {
  const calls = warnSpy.mock.calls as unknown as unknown[][]
  return calls
    .map((call) => call[0])
    .filter((first): first is string => typeof first === "string" && first.includes("admin_count_guard_check"))
}

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  clerk.state.reset()
  db.state.rows = []
  db.state.nextId = 1
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("T067 — last-admin guard under concurrency", () => {
  it("sequential offboards: the guard correctly refuses the second, and logs it", async () => {
    const { offboardUser } = await import("@/services/admin.server")
    clerk.state.users.set("admin_a", { role: "admin" })
    clerk.state.users.set("admin_b", { role: "admin" })

    const first = await offboardUser(db.client as never, actor, "admin_a", "departure A")
    expect(first.errorCode).not.toBe("LAST_ADMIN_GUARD")
    expect(clerk.state.users.get("admin_a")?.role).toBeNull()

    const second = await offboardUser(db.client as never, actor, "admin_b", "departure B")

    expect(second.outcome).toBe("refused")
    expect(second.errorCode).toBe("LAST_ADMIN_GUARD")
    // The guard's own structured warning -- FR-USR-5's "never silent" requirement.
    expect(guardWarnings().some((line) => line.includes("admin_b"))).toBe(true)
    // Refused, so the target's role must be untouched.
    expect(clerk.state.users.get("admin_b")?.role).toBe("admin")
  })

  it("concurrent offboards: the race is possible and can leave zero Admins (Tension 1, no lock)", async () => {
    const { offboardUser } = await import("@/services/admin.server")
    clerk.state.users.set("admin_a", { role: "admin" })
    clerk.state.users.set("admin_b", { role: "admin" })

    const [resultA, resultB] = await Promise.all([
      offboardUser(db.client as never, actor, "admin_a", "departure A"),
      offboardUser(db.client as never, actor, "admin_b", "departure B"),
    ])

    // Neither request observed the other's write in time -- both read
    // countActiveAdmins() == 2 before either updateUserMetadata landed, so
    // neither is refused by the guard.
    expect(resultA.errorCode).not.toBe("LAST_ADMIN_GUARD")
    expect(resultB.errorCode).not.toBe("LAST_ADMIN_GUARD")
    // The guard's own warning never fires here -- this IS the accepted gap,
    // not an assertion we want to pass by accident.
    expect(guardWarnings()).toEqual([])

    // The concrete bad outcome the guard exists to prevent: zero Admins left.
    expect(clerk.state.users.get("admin_a")?.role).toBeNull()
    expect(clerk.state.users.get("admin_b")?.role).toBeNull()
  })
})
