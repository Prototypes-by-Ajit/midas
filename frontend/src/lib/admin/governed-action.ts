import type { SupabaseClient } from "@supabase/supabase-js"

import { emitAdminEvent } from "@/lib/admin/analytics"

/**
 * The shared atomic pending-row / domain-call / RPC-finalize sequence every
 * governed action (invite, role change, offboard — T038-T040) uses.
 * TypeScript port of `backend/app/api/admin.py`'s `run_governed_action()`
 * (T024) — same terminal states, same compensate-vs-retry branching.
 *
 * Deliberately NOT in `services/admin.server.ts` (which imports
 * `"server-only"` for its Clerk calls) — this function's own logic touches
 * neither Clerk nor any server secret directly, it only takes a Supabase
 * client and a couple of callbacks. Keeping it here, alongside
 * `lib/admin/contract.ts`, makes it plain, unit-testable TypeScript (no RSC
 * boundary), the same separation `lib/reports/contract.ts` vs.
 * `services/*.server.ts` already establishes elsewhere in this codebase.
 *
 * Architecture decision, 2026-08-30 (user decision, speckit-implement
 * finding): the domain call for all three governed actions is a real Clerk
 * operation, and the Python backend has zero Clerk access (no SDK, no
 * secret, and this feature bans adding either) — so `admin.py`'s own
 * `run_governed_action()` (T024) can never actually be called by these three
 * actions. The BFF owns the whole action instead: it calls Clerk directly
 * AND calls the Postgres RPC directly, via this function, matching feature
 * 002's own already-proven BFF-only pattern. This does not violate D5 ("no
 * client-callable audit endpoint") — the RPC function is still the only
 * write path into `audit_events`, regardless of which language calls it.
 * `admin.py`'s own `run_governed_action()` stays in place, fully tested — the
 * atomicity pattern it encodes is correct, just not reachable from an action
 * whose domain call needs Clerk.
 */

export type GovernedActionOutcome = {
  outcome: "allowed" | "refused" | "pending" | "duplicate"
  evtId: string | null
  errorCode?: string
}

export type GovernedActor = { id: string; role: string }

// Bounded, not unbounded — same reasoning as admin.py's own
// _FINALIZE_RETRY_ATTEMPTS (quickstart.md's "retry until it succeeds" read
// literally would mean an open-ended loop inside an HTTP request the operator
// is waiting on).
const FINALIZE_RETRY_ATTEMPTS = 2

export async function runGovernedAction(
  supabase: SupabaseClient,
  actor: GovernedActor,
  action: string,
  targetType: string,
  targetId: string,
  reason: string | null | undefined,
  domainCall: () => Promise<void>,
  rpcCall: (pendingEvtId: string) => Promise<{ evtId: string; outcome: string }>,
  compensateCall?: () => Promise<void>,
): Promise<GovernedActionOutcome> {
  // T062 -- PRD §17's `governed_action_submitted`/`governed_action_completed`
  // events. Emitted here, not from admin.py's `run_governed_action()` (the
  // task's original text) -- the Phase 8 architecture pivot means this
  // TypeScript copy is the only one any live governed action actually calls;
  // admin.py's copy is unreachable from Clerk-touching actions (see this
  // file's own module docstring), so instrumenting it would be dead code.
  const emitCompleted = (outcome: string, errorCode?: string) =>
    emitAdminEvent("governed_action_completed", { action, target_type: targetType, outcome, error_code: errorCode })
  emitAdminEvent("governed_action_submitted", { action, target_type: targetType, actor_role: actor.role })

  // Step 4 of the Governed Action pattern (spec.md): empty/missing reason is
  // refused before any domain call or RPC call. `audit_events.reason` has
  // CHECK (length(trim(reason)) > 0) -- a genuinely empty reason can never be
  // written, including this refusal itself, so this sentinel is a system
  // annotation of what happened, never a claim about what the operator typed
  // (same fix as admin.py's own, applied here for the same reason).
  if (!reason || !reason.trim()) {
    const { data } = await supabase
      .from("audit_events")
      .insert({
        actor_id: actor.id,
        actor_role: actor.role,
        action,
        target_type: targetType,
        target_id: targetId,
        reason: "(no reason provided)",
        outcome: "refused",
      })
      .select()
      .single()

    emitCompleted("refused", "EMPTY_REASON")
    return { outcome: "refused", evtId: data?.id ?? null, errorCode: "EMPTY_REASON" }
  }

  // Step (1): pending row, its own trivial single-insert transaction.
  const { data: pendingRow, error: pendingError } = await supabase
    .from("audit_events")
    .insert({
      actor_id: actor.id,
      actor_role: actor.role,
      action,
      target_type: targetType,
      target_id: targetId,
      reason,
      outcome: "pending",
    })
    .select()
    .single()

  if (pendingError || !pendingRow) {
    throw new Error(`Failed to write pending audit_events row: ${pendingError?.message}`)
  }
  const pendingEvtId: string = pendingRow.id

  // Step (2): the domain call (Clerk). If it fails outright, nothing to
  // compensate -- finalize straight to refused.
  try {
    await domainCall()
  } catch (e) {
    console.warn(`governed action ${action} domain call failed for ${pendingEvtId}:`, e)
    await supabase
      .from("audit_events")
      .update({ outcome: "refused" })
      .eq("id", pendingEvtId)
      .eq("outcome", "pending")
    emitCompleted("refused", "DOMAIN_CALL_FAILED")
    return { outcome: "refused", evtId: pendingEvtId, errorCode: "DOMAIN_CALL_FAILED" }
  }

  // Step (3): the RPC finalize.
  try {
    const result = await rpcCall(pendingEvtId)
    emitCompleted(result.outcome)
    return { outcome: result.outcome as GovernedActionOutcome["outcome"], evtId: result.evtId }
  } catch (e) {
    console.error(`governed action ${action} RPC finalize failed for ${pendingEvtId}:`, e)

    if (compensateCall) {
      // invite / role-change: a real undo exists.
      try {
        await compensateCall()
        await supabase
          .from("audit_events")
          .update({ outcome: "refused" })
          .eq("id", pendingEvtId)
          .eq("outcome", "pending")
        emitCompleted("refused", "RPC_FAILED_COMPENSATED")
        return { outcome: "refused", evtId: pendingEvtId, errorCode: "RPC_FAILED_COMPENSATED" }
      } catch (compensateError) {
        // The one gap eng review finding 1 exists to make loud instead of
        // silent: domain change stands, no compensation, row stays pending.
        // T063 -- this line IS the "must never be silent" event; also
        // emitted as the generic completed event below so both PRD §17
        // names are satisfied by the one real occurrence, not invented
        // twice. No paging integration exists in this repo to wire the
        // error-level log to (no PagerDuty/Opsgenie client anywhere) --
        // flagged, not fixed, same class as OQ7.
        console.error(
          `governed_action_audit_write_failed: pending_evt_id=${pendingEvtId} action=${action} compensation also failed:`,
          compensateError,
        )
        emitAdminEvent("governed_action_audit_write_failed", { action, target_type: targetType, pending_evt_id: pendingEvtId })
        emitCompleted("pending", "COMPENSATION_FAILED")
        return { outcome: "pending", evtId: pendingEvtId, errorCode: "COMPENSATION_FAILED" }
      }
    } else {
      // offboard: no undo for a revoked session. Retry the finalize alone
      // (bounded), never compensate/undo the revocation.
      for (let attempt = 1; attempt < FINALIZE_RETRY_ATTEMPTS; attempt++) {
        try {
          const retryResult = await rpcCall(pendingEvtId)
          emitCompleted(retryResult.outcome)
          return { outcome: retryResult.outcome as GovernedActionOutcome["outcome"], evtId: retryResult.evtId }
        } catch (retryError) {
          console.error(
            `governed action ${action} finalize retry ${attempt} failed for ${pendingEvtId}:`,
            retryError,
          )
        }
      }
      // T063 -- same "must never be silent" event as the compensation-failed
      // branch above.
      console.error(
        `governed_action_audit_write_failed: pending_evt_id=${pendingEvtId} action=${action} all finalize retries exhausted, domain change already applied`,
      )
      emitAdminEvent("governed_action_audit_write_failed", { action, target_type: targetType, pending_evt_id: pendingEvtId })
      emitCompleted("pending", "RETRY_EXHAUSTED")
      return { outcome: "pending", evtId: pendingEvtId, errorCode: "RETRY_EXHAUSTED" }
    }
  }
}
