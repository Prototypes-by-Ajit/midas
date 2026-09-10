/**
 * T034 / T035 — the two "done when" criteria named in tasks.md that were
 * never actually asserted anywhere: `getUsers({ operatorOnly: true })` must
 * never return a patient/clinician row (FR-USR-1), and `getUserDetail()` for
 * a user with zero audit history must return an empty-state shape, not an
 * error (FR-USR-2). Both functions were already implemented and wired into
 * their pages; this suite is the missing verification, not new behavior.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const clerk = vi.hoisted(() => {
  const state = {
    users: [] as { id: string; role: string; firstName?: string }[],
    reset() {
      state.users = []
    },
  }

  const client = {
    users: {
      getUserList: async (params: { offset: number }) => ({
        // One page only -- every test here fits well under CLERK_PAGE_SIZE.
        data:
          params.offset === 0
            ? state.users.map((u) => ({
                id: u.id,
                emailAddresses: [{ emailAddress: `${u.id}@example.invalid` }],
                firstName: u.firstName ?? "",
                lastName: "",
                privateMetadata: {},
                publicMetadata: { role: u.role },
                createdAt: 0,
                lastSignInAt: null,
                imageUrl: "",
              }))
            : [],
      }),
      getUser: async (id: string) => {
        const u = state.users.find((x) => x.id === id)
        return {
          id,
          emailAddresses: [{ emailAddress: `${id}@example.invalid` }],
          firstName: u?.firstName ?? "",
          lastName: "",
          privateMetadata: {},
          publicMetadata: { role: u?.role ?? "patient" },
          createdAt: 0,
          lastSignInAt: null,
          imageUrl: "",
          banned: false,
          locked: false,
          twoFactorEnabled: false,
          passwordEnabled: true,
        }
      },
    },
    sessions: {
      getSessionList: async () => ({ data: [] }),
    },
  }

  return { state, client }
})

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => clerk.client,
}))

beforeEach(() => {
  clerk.state.reset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// --------------------------------------------------------------------------- //
// T034 -- FR-USR-1: operatorOnly never leaks a patient/clinician row.
// --------------------------------------------------------------------------- //

describe("getUsers({ operatorOnly })", () => {
  it("never returns a patient or clinician row when operatorOnly is true", async () => {
    clerk.state.users = [
      { id: "u_admin", role: "admin" },
      { id: "u_patient", role: "patient" },
      { id: "u_clinician", role: "clinician" },
    ]

    const { getUsers } = await import("@/services/admin.server")
    const result = await getUsers({ operatorOnly: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.map((u) => u.id)).toEqual(["u_admin"])
    expect(result.data.every((u) => u.role === "admin")).toBe(true)
  })

  it("returns every role when operatorOnly is omitted (unchanged default behavior)", async () => {
    clerk.state.users = [
      { id: "u_admin", role: "admin" },
      { id: "u_patient", role: "patient" },
    ]

    const { getUsers } = await import("@/services/admin.server")
    const result = await getUsers()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.map((u) => u.id).sort()).toEqual(["u_admin", "u_patient"])
  })
})

// --------------------------------------------------------------------------- //
// T035 -- FR-USR-2: zero audit history is an empty-state shape, not an error.
// --------------------------------------------------------------------------- //

describe("getUserDetail() audit activity", () => {
  it("returns an empty auditActivity array, ok:true, when no actor is passed", async () => {
    clerk.state.users = [{ id: "u_target", role: "patient" }]

    const { getUserDetail } = await import("@/services/admin.server")
    const result = await getUserDetail("u_target")

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.auditActivity).toEqual([])
  })

  it("returns an empty auditActivity array, ok:true, when the backend genuinely has zero matching rows", async () => {
    clerk.state.users = [{ id: "u_target", role: "patient" }]
    vi.stubEnv("BACKEND_URL", "http://localhost:8000")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [], next_cursor: null, result_count: 0 }),
      })),
    )

    const { getUserDetail } = await import("@/services/admin.server")
    const result = await getUserDetail("u_target", { id: "admin_1", role: "admin" })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.auditActivity).toEqual([])
  })
})
