/**
 * T077 [US6] — a report row written before `014` still renders truthfully.
 *
 * The values below are not invented. They were read out of the T075 provisioning
 * rehearsal, where a row was planted in an empty database *before* `014` was
 * applied and then re-read afterwards:
 *
 *   status=archived  number=MIDAS-REP-20251114-LEG1CY
 *   sections_generated=NULL  generator=NULL
 *
 * The database half of T077 is proven there — the row survived `014` and a second
 * application of the whole migration set byte-identical. This is the other half:
 * that the interface reading such a row states what it does not know, rather than
 * filling the gap in (Assumption 2, spec edge case 12).
 */

import { describe, expect, it } from "vitest"

import { STATUS_PRESENTATION, missingSections, presentStatus } from "./status-presentation"

/** Exactly what the rehearsal left in the row. */
const HISTORICAL_STATUS = "archived"

describe("a pre-014 report row", () => {
  it("displays an out-of-vocabulary status verbatim rather than remapping it", () => {
    // Rewriting `archived` to the nearest known state would be the interface
    // inventing a fact about a document it did not produce.
    expect(presentStatus(HISTORICAL_STATUS).label).toBe(HISTORICAL_STATUS)
  })

  it("never presents an unknown status as a successful one", () => {
    const presentation = presentStatus(HISTORICAL_STATUS)
    for (const known of [STATUS_PRESENTATION.completed, STATUS_PRESENTATION.degraded]) {
      expect(presentation.label).not.toBe(known.label)
    }
  })

  it("still carries a label, colour and icon, so the chip is never bare", () => {
    const presentation = presentStatus(HISTORICAL_STATUS)
    expect(presentation.label).toBeTruthy()
    expect(presentation.chipClass).toBeTruthy()
    expect(presentation.icon).toBeTruthy()
  })

  it("says provenance was not recorded, rather than reporting nothing missing", () => {
    // The dangerous failure is the empty string: it is what a *complete* report
    // returns, so a null provenance rendering as "" would read as four-of-four.
    const phrase = missingSections(null)
    expect(phrase).not.toBe("")
    expect(phrase).toContain("not recorded")
  })

  it("distinguishes 'nothing recorded' from 'nothing missing'", () => {
    const complete = missingSections({
      summary: true,
      observations: true,
      recommendations: true,
      limitations: true,
    })
    expect(complete).toBe("")
    expect(missingSections(null)).not.toBe(complete)
  })

  it("is treated as terminal — no stale relabelling applies to it", () => {
    // `stale` only ever rewrites `generating`. A historical row must not acquire
    // "Didn't finish" just because it is old.
    expect(presentStatus(HISTORICAL_STATUS, { stale: true }).label).toBe(HISTORICAL_STATUS)
  })
})
