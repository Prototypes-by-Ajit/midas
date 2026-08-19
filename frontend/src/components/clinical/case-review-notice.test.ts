/**
 * T040 [US5] — a historical analysis renders byte-identically to its pre-feature
 * output (G3).
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. There is no jsdom in this repo, so
 * nothing here renders anything. The named assertion is decomposed into the two
 * properties it actually rests on, and both are checkable without a DOM:
 *
 *   1. `presentCaseState("patient", null)` returns `null` — asserted in
 *      `data/clinical/case-presentation.test.ts`.
 *   2. `CaseReviewNotice` returns `null` on that result, before constructing any
 *      element — asserted structurally below.
 *
 * Together they mean the component contributes nothing to the tree for a
 * pre-feature row, which is what "byte-identical" reduces to once the only
 * change to the surface is one conditional element. **A render-level diff of the
 * two trees needs jsdom, which is its own task.**
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { presentCaseState } from "@/data/clinical/case-presentation"

const source = readFileSync(
  fileURLToPath(new URL("./case-review-notice.tsx", import.meta.url)),
  "utf8",
)

const code = source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")

describe("a pre-feature analysis gains no review element", () => {
  it("resolves a NULL review state to nothing for a patient", () => {
    expect(presentCaseState("patient", null)).toBeNull()
  })

  it("returns null before building any element", () => {
    // The guard has to come before the first `<`, or the component has already
    // constructed a wrapper it will then render empty — which is a DOM change,
    // and a layout change, for a row that had no review.
    const guard = code.indexOf("if (!cell) return null")
    expect(guard, "the early return is missing").toBeGreaterThan(-1)
    expect(guard).toBeLessThan(code.indexOf("return ("))
  })

  it("keeps the review element to a single call site on the patient surface", () => {
    const console_ = readFileSync(
      fileURLToPath(new URL("../../comps/dashboard/history/history-console.tsx", import.meta.url)),
      "utf8",
    )
    const uses = console_.match(/<CaseReviewNotice/g) ?? []
    expect(uses).toHaveLength(1)
    // Passed the row's own value, never a default that would fabricate a state.
    expect(console_).toContain("reviewState={entry.review_state}")
  })
})

describe("the patient's review element", () => {
  it("shows the released disclaimer only once released (FR-053)", () => {
    expect(code).toContain('reviewState === "released" && <NotADiagnosisNotice')
  })

  it("reuses the existing disclaimer rather than writing new copy", () => {
    // FR-053 already has a component. A second wording of the same caveat is a
    // second thing to keep true.
    expect(code).toContain('from "@/components/clinical/medical-disclaimer"')
    expect(code).not.toMatch(/not a diagnosis/i)
  })

  it("renders the clinician's ask as text, not as a badge (FR-006)", () => {
    expect(code).toContain("{requestedAction}")
    expect(code).toContain("whitespace-pre-wrap")
  })
})
