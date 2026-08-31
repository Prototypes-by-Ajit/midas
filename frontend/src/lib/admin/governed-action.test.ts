/**
 * T038-T040's shared helper — TypeScript port of
 * backend/app/api/admin.py's run_governed_action() (T024). Same six terminal
 * states as tests/test_run_governed_action.py (the Python original), against
 * a fake Supabase client (no live database, no live Clerk).
 */
import { describe, expect, it } from "vitest"

import { runGovernedAction } from "./governed-action"

type Row = Record<string, unknown> & { id: string; outcome: string }

/** Just enough of the supabase-js chained-query shape for audit_events
 * insert/update -- `.from("audit_events").insert({...}).select().single()`
 * and `.from("audit_events").update({...}).eq(...).eq(...)`. */
function makeFakeSupabase() {
  const rows = new Map<string, Row>()
  let nextId = 1

  const client = {
    from(table: string) {
      if (table !== "audit_events") throw new Error(`unexpected table ${table}`)
      return {
        insert(values: Record<string, unknown>) {
          const id = `evt_${nextId++}`
          const row = { id, ...values } as Row
          rows.set(id, row)
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          }
        },
        update(values: Record<string, unknown>) {
          const filters: Record<string, unknown> = {}
          const builder = {
            eq(column: string, value: unknown) {
              filters[column] = value
              return builder
            },
            // Terminal await point -- supabase-js resolves the builder itself.
            then(resolve: (v: { data: unknown; error: null }) => void) {
              const row = rows.get(filters.id as string)
              if (row && Object.entries(filters).every(([k, v]) => row[k] === v)) {
                Object.assign(row, values)
              }
              resolve({ data: null, error: null })
            },
          }
          return builder
        },
      }
    },
    rows,
  }
  return client
}

const actor = { id: "user_1", role: "admin" }

describe("runGovernedAction", () => {
  it("refuses an empty reason before any domain call, no pending row", async () => {
    const supabase = makeFakeSupabase()
    let domainCallRan = false
    let rpcCallRan = false

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client, not the full SupabaseClient type
      supabase,
      actor,
      "user.invite",
      "invite",
      "a@example.com",
      "  ",
      async () => {
        domainCallRan = true
      },
      async (id) => {
        rpcCallRan = true
        return { evtId: id, outcome: "allowed" }
      },
    )

    expect(result.outcome).toBe("refused")
    expect(result.errorCode).toBe("EMPTY_REASON")
    expect(domainCallRan).toBe(false)
    expect(rpcCallRan).toBe(false)
    // DB CHECK (length(trim(reason)) > 0) would reject a true empty string --
    // the sentinel is what actually got written.
    expect(supabase.rows.get(result.evtId!)?.reason).toBe("(no reason provided)")
  })

  it("happy path: allowed", async () => {
    const supabase = makeFakeSupabase()

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.invite",
      "invite",
      "a@example.com",
      "onboarding",
      async () => {},
      async (id) => {
        // Simulates what the real RPC does: reconciles the row itself.
        supabase.rows.get(id)!.outcome = "allowed"
        return { evtId: id, outcome: "allowed" }
      },
    )

    expect(result.outcome).toBe("allowed")
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("allowed")
  })

  it("domain call fails: refused, RPC never called", async () => {
    const supabase = makeFakeSupabase()
    let rpcCallRan = false

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.invite",
      "invite",
      "a@example.com",
      "onboarding",
      async () => {
        throw new Error("Clerk unreachable")
      },
      async (id) => {
        rpcCallRan = true
        return { evtId: id, outcome: "allowed" }
      },
    )

    expect(result.outcome).toBe("refused")
    expect(result.errorCode).toBe("DOMAIN_CALL_FAILED")
    expect(rpcCallRan).toBe(false)
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("refused")
  })

  it("RPC fails, compensation succeeds: refused (invite/role-change shape)", async () => {
    const supabase = makeFakeSupabase()
    let compensated = false

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.invite",
      "invite",
      "a@example.com",
      "onboarding",
      async () => {},
      async () => {
        throw new Error("RPC unreachable")
      },
      async () => {
        compensated = true
      },
    )

    expect(result.outcome).toBe("refused")
    expect(result.errorCode).toBe("RPC_FAILED_COMPENSATED")
    expect(compensated).toBe(true)
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("refused")
  })

  it("RPC and compensation both fail: stays pending, never silently vanishes", async () => {
    const supabase = makeFakeSupabase()

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.invite",
      "invite",
      "a@example.com",
      "onboarding",
      async () => {},
      async () => {
        throw new Error("RPC unreachable")
      },
      async () => {
        throw new Error("Clerk unreachable for compensation too")
      },
    )

    expect(result.outcome).toBe("pending")
    expect(result.errorCode).toBe("COMPENSATION_FAILED")
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("pending")
  })

  it("offboard shape (no compensateCall): retries and can succeed", async () => {
    const supabase = makeFakeSupabase()
    let callCount = 0

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.offboard",
      "user",
      "user_2",
      "policy violation",
      async () => {}, // session already revoked, no undo possible
      async (id) => {
        callCount += 1
        if (callCount === 1) throw new Error("transient RPC failure")
        supabase.rows.get(id)!.outcome = "allowed"
        return { evtId: id, outcome: "allowed" }
      },
      // no compensateCall -- offboard shape
    )

    expect(result.outcome).toBe("allowed")
    expect(callCount).toBe(2)
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("allowed")
  })

  it("offboard shape: retries exhausted, stays pending, never compensates", async () => {
    const supabase = makeFakeSupabase()

    const result = await runGovernedAction(
      // @ts-expect-error -- fake client
      supabase,
      actor,
      "user.offboard",
      "user",
      "user_2",
      "policy violation",
      async () => {},
      async () => {
        throw new Error("RPC persistently unreachable")
      },
    )

    expect(result.outcome).toBe("pending")
    expect(result.errorCode).toBe("RETRY_EXHAUSTED")
    expect(supabase.rows.get(result.evtId!)?.outcome).toBe("pending")
  })
})
