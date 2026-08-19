/**
 * T033 [US6] — the presentation tables, asserted cell by cell.
 *
 * FR-040 says a surface missing any cell is incomplete, and SC-005 says all
 * fifteen are demonstrably reachable. A missing cell is not a crash — it is
 * `undefined` reaching a `label` prop and rendering as nothing, which is exactly
 * the failure that ships: the patient sees a blank where their status should be,
 * and no one notices because the page still renders.
 *
 * These are unit tests over plain data, which is why `case-presentation.ts`
 * imports only types. Nothing here mounts a component.
 */

import { describe, expect, it } from "vitest"

import { CASE_REVIEW_STATES } from "@/lib/clinical/contract"
import {
  CASE_STATE_PRESENTATION,
  SHARED_STATE_PRESENTATION,
  SHARED_VIEW_STATES,
  USER_ROLES,
  formatWaitTime,
  hasNoUsableResult,
  presentCaseState,
  presentSharedState,
  type Presentation,
} from "./case-presentation"

/** Colour stripped. What is left has to carry the meaning on its own (FR-041). */
const withoutColour = (cell: Presentation) => `${cell.label}|${cell.description}`

describe("shared view states — FR-040's fifteen cells", () => {
  it("has all fifteen, none empty", () => {
    expect(USER_ROLES).toHaveLength(3)
    expect(SHARED_VIEW_STATES).toHaveLength(5)

    const cells: Presentation[] = []
    for (const role of USER_ROLES) {
      for (const state of SHARED_VIEW_STATES) {
        const cell = SHARED_STATE_PRESENTATION[role][state]
        expect(cell, `${role}/${state} is missing`).toBeDefined()
        expect(cell.label.trim(), `${role}/${state} label is empty`).not.toBe("")
        expect(cell.description.trim(), `${role}/${state} description is empty`).not.toBe("")
        cells.push(cell)
      }
    }

    expect(cells).toHaveLength(15)
  })

  it("gives no two roles the same cell object by reference", () => {
    // Sharing a cell between roles is how one edit silently rewrites another
    // role's copy — the specific hazard being that a clinician-voiced sentence
    // ends up on a patient's screen.
    for (const state of SHARED_VIEW_STATES) {
      const [patient, clinician, admin] = USER_ROLES.map(
        (role) => SHARED_STATE_PRESENTATION[role][state],
      )
      expect(patient).not.toBe(clinician)
      expect(clinician).not.toBe(admin)
      expect(patient).not.toBe(admin)
    }
  })

  it("routes no-result away from error styling in all three roles", () => {
    // SC-006: 0 analyses with no usable result are presented as errors. An
    // analysis that produced nothing is a case for a human, not a fault.
    for (const role of USER_ROLES) {
      expect(SHARED_STATE_PRESENTATION[role].no_result.tone).not.toBe("critical")
    }
  })

  it("does not disclose existence in the denied cell", () => {
    // FR-031 at the presentation layer: the copy must be usable whether or not
    // the case exists, so it cannot mention the case, the holder, or a reason.
    for (const role of USER_ROLES) {
      const denied = withoutColour(SHARED_STATE_PRESENTATION[role].denied).toLowerCase()
      expect(denied).not.toMatch(/another clinician|already claimed|belongs to|exists/)
    }
  })
})

describe("clinical states — eighteen cells", () => {
  it("has all eighteen, none empty", () => {
    const cells: Presentation[] = []
    for (const role of USER_ROLES) {
      for (const state of CASE_REVIEW_STATES) {
        const cell = CASE_STATE_PRESENTATION[role][state]
        expect(cell, `${role}/${state} is missing`).toBeDefined()
        expect(cell.label.trim(), `${role}/${state} label is empty`).not.toBe("")
        expect(cell.description.trim(), `${role}/${state} description is empty`).not.toBe("")
        cells.push(cell)
      }
    }

    expect(cells).toHaveLength(18)
  })

  it("gives no two roles the same cell object by reference", () => {
    for (const state of CASE_REVIEW_STATES) {
      const [patient, clinician, admin] = USER_ROLES.map(
        (role) => CASE_STATE_PRESENTATION[role][state],
      )
      expect(patient).not.toBe(clinician)
      expect(clinician).not.toBe(admin)
      expect(patient).not.toBe(admin)
    }
  })

  it("makes every cell in a role distinguishable with colour stripped", () => {
    // Two states that read identically in text are two states a screen reader
    // user, or anyone with the stylesheet off, cannot tell apart (FR-041, SC-009).
    for (const role of USER_ROLES) {
      const rendered = CASE_REVIEW_STATES.map((state) =>
        withoutColour(CASE_STATE_PRESENTATION[role][state]),
      )
      expect(new Set(rendered).size, `${role} has duplicate copy`).toBe(rendered.length)
    }
  })

  it("never puts a score or a risk word on the patient's surface", () => {
    // SC-010: a patient reading their own case before release cannot state what
    // the machine predicted. A status line is the easiest place to leak it.
    for (const state of CASE_REVIEW_STATES) {
      const text = withoutColour(CASE_STATE_PRESENTATION.patient[state]).toLowerCase()
      expect(text, `patient/${state} leaks model output`).not.toMatch(
        /\d\s*%|confidence|melanoma|malignant|benign|high risk|low risk|risk level|probability/,
      )
    }
  })
})

describe("presentCaseState", () => {
  it("renders nothing for a patient whose review_state is NULL (G3)", () => {
    // A historical analysis must be byte-identical to its pre-feature output.
    // `null` here is what makes that possible: the caller renders no element at
    // all rather than an "unknown" badge that did not used to be there.
    expect(presentCaseState("patient", null)).toBeNull()
    expect(presentCaseState("patient", undefined)).toBeNull()
  })

  it("keeps unknown for clinician and admin, where it is operationally real", () => {
    for (const role of ["clinician", "admin"] as const) {
      const cell = presentCaseState(role, null)
      expect(cell).not.toBeNull()
      expect(cell?.label).toBe("Unknown")
    }
  })

  it("displays an unrecognised state verbatim rather than rewriting it", () => {
    const cell = presentCaseState("clinician", "escalated_1990")
    expect(cell?.label).toBe("escalated_1990")
  })

  it("returns the table cell for every known state and role", () => {
    for (const role of USER_ROLES) {
      for (const state of CASE_REVIEW_STATES) {
        expect(presentCaseState(role, state)).toBe(CASE_STATE_PRESENTATION[role][state])
      }
    }
  })
})

describe("presentSharedState", () => {
  it("returns the table cell for every role and state", () => {
    for (const role of USER_ROLES) {
      for (const state of SHARED_VIEW_STATES) {
        expect(presentSharedState(role, state)).toBe(SHARED_STATE_PRESENTATION[role][state])
      }
    }
  })
})

describe("hasNoUsableResult", () => {
  it("is true for a failed analysis and for a null diagnosis", () => {
    expect(hasNoUsableResult({ status: "failed", diagnosis: "melanoma" })).toBe(true)
    expect(hasNoUsableResult({ status: "completed", diagnosis: null })).toBe(true)
    expect(hasNoUsableResult({ status: "completed", diagnosis: "" })).toBe(true)
  })

  it("is false for a completed analysis with a diagnosis", () => {
    expect(hasNoUsableResult({ status: "completed", diagnosis: "melanoma" })).toBe(false)
  })
})

describe("formatWaitTime", () => {
  it("rounds down, so a wait is never overstated", () => {
    expect(formatWaitTime(59 * 60_000)).toBe("59 min")
    expect(formatWaitTime(60 * 60_000)).toBe("1 hour")
    expect(formatWaitTime(23.9 * 60 * 60_000)).toBe("23 hours")
    expect(formatWaitTime(24 * 60 * 60_000)).toBe("1 day")
    expect(formatWaitTime(3.9 * 24 * 60 * 60_000)).toBe("3 days")
  })

  it("says just now rather than 0 min", () => {
    expect(formatWaitTime(0)).toBe("just now")
    expect(formatWaitTime(30_000)).toBe("just now")
  })

  it("does not invent a duration from a bad clock", () => {
    // A negative wait means the row's created_at is ahead of the server clock.
    // "unknown" is the honest answer; "just now" would hide a real problem.
    expect(formatWaitTime(-1)).toBe("unknown")
    expect(formatWaitTime(Number.NaN)).toBe("unknown")
  })
})
