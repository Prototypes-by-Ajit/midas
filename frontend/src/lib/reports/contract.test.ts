/**
 * T016 [US5] — every report number the orchestrator mints must be insertable.
 *
 * `generate/route.ts:87` builds its fallback from
 * `Math.random().toString(36).slice(2, 8)`. That expression yields six characters
 * only when the float's base-36 expansion happens to be long enough; when it is
 * short, the number ends up under six characters and violates migration 007's
 * CHECK constraint at insert time. The failure is rare, non-deterministic, and
 * lands as a 500 on someone who did nothing wrong (D11, V6).
 *
 * A property this thin is only worth asserting at volume, so `makeReportNumber()`
 * is exercised 10 000 times against the shared pattern. The last test pins the
 * defect the shared helper exists to replace.
 *
 * CONTRACT ASSUMED (T019): the module does not exist yet, so the loading tests
 * fail until it does. Loaded dynamically so that failure is a test failure with a
 * message, not a collection error.
 */

import { describe, expect, it } from "vitest"

type Contract = typeof import("./contract")

const load = (): Promise<Contract> => import("./contract")

const ITERATIONS = 10_000

describe("makeReportNumber", () => {
  it(`matches REPORT_NUMBER_PATTERN across ${ITERATIONS} iterations`, async () => {
    const { makeReportNumber, REPORT_NUMBER_PATTERN } = await load()
    const pattern = new RegExp(REPORT_NUMBER_PATTERN)

    const offenders: string[] = []
    for (let i = 0; i < ITERATIONS; i += 1) {
      const candidate = makeReportNumber()
      if (!pattern.test(candidate)) offenders.push(candidate)
    }

    expect(offenders.slice(0, 10)).toEqual([])
    expect(offenders).toHaveLength(0)
  })

  it("always emits a six-character token", async () => {
    const { makeReportNumber } = await load()
    const lengths = new Set<number>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      lengths.add(makeReportNumber().split("-").at(-1)!.length)
    }
    expect([...lengths]).toEqual([6])
  })

  it("draws the token from [A-Z0-9] only", async () => {
    const { makeReportNumber } = await load()
    const chars = new Set<string>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      for (const c of makeReportNumber().split("-").at(-1)!) chars.add(c)
    }
    const outside = [...chars].filter((c) => !/[A-Z0-9]/.test(c))
    expect(outside).toEqual([])
  })

  it("is not a constant", async () => {
    // A generator that returned one value would pass every test above and
    // collide on the first duplicate insert.
    const { makeReportNumber } = await load()
    const seen = new Set<string>()
    for (let i = 0; i < 1_000; i += 1) seen.add(makeReportNumber())
    expect(seen.size).toBeGreaterThan(900)
  })
})

describe("the generator being replaced", () => {
  it("can emit a token shorter than six characters", async () => {
    // The reproduction, made deterministic: (0.5).toString(36) === "0.i", so
    // slice(2, 8) is a single character and the number becomes MIDAS-REP-...-I,
    // which migration 007's CHECK rejects.
    const legacyToken = (random: number) => random.toString(36).slice(2, 8).toUpperCase()

    expect(legacyToken(0.5)).toHaveLength(1)

    const { REPORT_NUMBER_PATTERN } = await load()
    expect(new RegExp(REPORT_NUMBER_PATTERN).test(`MIDAS-REP-20260714-${legacyToken(0.5)}`)).toBe(
      false
    )
  })
})
