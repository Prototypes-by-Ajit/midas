import { describe, expect, it } from "vitest"

import { AUDIT_PAGE_SIZE, mergeTimeline } from "./audit-timeline"
import type { AuditEvent, PolicyBlockEvent } from "@/types/dashboard"

function audit(id: string, created_at: string): AuditEvent {
  return {
    id,
    corr_id: null,
    actor_id: "u1",
    actor_role: "admin",
    action: "user.invite",
    target_type: "invite",
    target_id: "t1",
    reason: "test",
    outcome: "allowed",
    created_at,
  }
}

function policyBlock(id: string, created_at: string): PolicyBlockEvent {
  return {
    id,
    corr_id: null,
    subject_role: "patient",
    classification: "no_dermatology_keywords",
    escalated_to_review: false,
    created_at,
  }
}

describe("mergeTimeline", () => {
  it("interleaves both sources newest-first", () => {
    const merged = mergeTimeline(
      [audit("a1", "2026-01-01T00:00:03Z"), audit("a2", "2026-01-01T00:00:01Z")],
      [policyBlock("p1", "2026-01-01T00:00:02Z")],
    )
    expect(merged.map((r) => r.row.id)).toEqual(["a1", "p1", "a2"])
    expect(merged.map((r) => r.kind)).toEqual(["audit", "policy_block", "audit"])
  })

  it("caps the merged page at AUDIT_PAGE_SIZE even when both sources are full pages", () => {
    const audits = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) =>
      audit(`a${i}`, `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`),
    )
    const blocks = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) =>
      policyBlock(`p${i}`, `2026-01-01T00:${String(i).padStart(2, "0")}:30Z`),
    )
    const merged = mergeTimeline(audits, blocks)
    expect(merged).toHaveLength(AUDIT_PAGE_SIZE)
    // Sorted strictly non-increasing -- no source's rows appear out of order.
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].created_at >= merged[i].created_at).toBe(true)
    }
  })

  it("returns an empty timeline when both sources are empty", () => {
    expect(mergeTimeline([], [])).toEqual([])
  })
})
