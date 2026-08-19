/**
 * The rendering claims of T041–T048, asserted against source.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. There is no jsdom in this repo, so
 * nothing here renders anything. Every assertion below is therefore structural:
 * it reads a component's source and checks a property that survives rendering —
 * a string is present, a branch exists, an import is absent, a whole class of
 * element never appears. That is strong enough for the claims these tasks make,
 * because each one is about what the source *can* produce rather than about
 * layout: a page that never imports a mutating call cannot make one, and copy
 * that is not in the file cannot be on the screen.
 *
 * What it does not prove: focus order as a browser computes it, contrast, and
 * whether a 44px class resolves to 44 real pixels under this Tailwind config.
 * Those need the browser pass the release gate already requires — this suite
 * does not substitute for it, and the gate must not be recorded as met because
 * this file is green.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

const HISTORY_CONSOLE = read("../../comps/dashboard/history/history-console.tsx")
const HISTORY_PAGE = read("../../app/dashboard/history/page.tsx")
const VERSION_PANEL = read("../../components/clinical/version-panel.tsx")
const OPERATIONS_PAGE = read("../../app/dashboard/operations/page.tsx")
const QUEUE_PAGE = read("../../app/dashboard/queue/page.tsx")
const CASE_PAGE = read("../../app/dashboard/queue/[id]/page.tsx")
const NAVIGATION = read("../../data/dashboard/navigation.ts")

/**
 * Source with comments removed.
 *
 * Every "this file must not mention X" assertion runs against this, not the raw
 * text. The admin page's own comments explain *why* it carries no diagnosis, and
 * a naive grep for "diagnosis" would fail on the sentence promising there is
 * none — turning an accurate comment into a broken test and teaching the next
 * person to delete the explanation.
 */
const code = (source: string) =>
  // Line comments FIRST. A `//` comment may legitimately contain `/*` — a path
  // like `/api/clinical/*` does — and stripping blocks first would treat that as
  // an opening delimiter and swallow everything up to the next `*/`, silently
  // hiding real code from every assertion below. That failure looked exactly
  // like the page missing a field it plainly had.
  source.replace(/^\s*\/\/.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ")

/** JSX text as a reader sees it: entities decoded, whitespace collapsed. */
const rendered = (source: string) =>
  source
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")

describe("T041 — the generate control is replaced, not disabled (G4)", () => {
  it("carries the exact line, verbatim", () => {
    expect(rendered(HISTORY_CONSOLE)).toContain(
      "A clinician is preparing your report. It will appear here when it's ready.",
    )
  })

  it("replaces the control rather than disabling it", () => {
    // A greyed button with a tooltip is invisible on a touch screen. The flag
    // must gate which branch renders, never a `disabled` prop.
    expect(HISTORY_CONSOLE).toContain("awaitingClinicianReport ? (")
    expect(HISTORY_CONSOLE).not.toMatch(/disabled=\{[^}]*awaitingClinicianReport/)
  })

  it("only replaces it while a case is in review with nothing released", () => {
    expect(code(HISTORY_CONSOLE)).toContain(
      "entry.review_state !== null && !releasedVersion",
    )
  })

  it("leaves delete alone — T041 names the generate control and nothing else", () => {
    expect(HISTORY_CONSOLE).toContain("Delete")
  })
})

describe("T042 — the released version, and the under-revision notice (FR-029, SC-012)", () => {
  it("carries the under-revision copy, verbatim", () => {
    expect(VERSION_PANEL).toContain(
      "A clinician is revising this report. The version below is the one currently released.",
    )
  })

  it("renders the notice ABOVE the version, and never instead of it", () => {
    // SC-012: there is no interval in which the patient sees nothing. The panel
    // must not early-return on a correction, and the version block must sit
    // outside the notice's conditional.
    const body = VERSION_PANEL.slice(VERSION_PANEL.indexOf("export function VersionPanel"))

    expect(body).toContain("{correctionStartedAt && (")
    expect(body).not.toMatch(/if\s*\(correctionStartedAt\)\s*return/)

    const noticeAt = body.indexOf("correctionStartedAt &&")
    const versionAt = body.indexOf("Version {versionNumber}")
    expect(noticeAt).toBeGreaterThan(-1)
    expect(versionAt).toBeGreaterThan(noticeAt)
  })

  it("reaches the patient only through a released-version read (FR-026)", () => {
    expect(HISTORY_PAGE).toContain("getReleasedVersionsByAnalysis")
  })

  it("withholds a stored report for a case in review that has not been released", () => {
    // The gap this feature would otherwise leave open: `getLatestReportsByAnalysis`
    // scopes by user and nothing else, and a `generated_reports` row exists from
    // the moment a decision is recorded — before signature, before release.
    expect(code(HISTORY_PAGE)).toContain("inReviewWithoutRelease")
    expect(code(HISTORY_PAGE)).toContain("!inReviewWithoutRelease.has(analysisId)")
  })

  it("does not withhold from an analysis that never entered review (G3)", () => {
    expect(code(HISTORY_PAGE)).toContain("entry.review_state !== null && !releasedVersions[entry.id]")
  })
})

describe("T050 — a signed version whose document is gone still shows its signature", () => {
  it("renders the signature from the row, independent of the document state", () => {
    const body = VERSION_PANEL.slice(VERSION_PANEL.indexOf("export function VersionPanel"))

    // Gated on `signedBy` alone. Gating it on the document state instead would
    // make a storage failure read as an unsigned report.
    expect(body).toContain("{signedBy && (")
    expect(body).not.toMatch(/documentState[^\n]*&&[^\n]*signedBy/)
  })
})

describe("T043 — the no-result path in the patient view (FR-042)", () => {
  it("carries the exact copy", () => {
    const text = rendered(HISTORY_CONSOLE)
    expect(text).toContain("The automated step didn't produce a result.")
    expect(text).toContain("A clinician is reviewing your case.")
  })

  it("renders it through the normal path, not through ErrorState", () => {
    expect(code(HISTORY_CONSOLE)).not.toContain("ErrorState")
  })

  it("carries no score and no risk word in the no-result branch", () => {
    const start = HISTORY_CONSOLE.indexOf("{noResult ? (")
    expect(start).toBeGreaterThan(-1)
    const branch = HISTORY_CONSOLE.slice(start, HISTORY_CONSOLE.indexOf(") : (", start))

    expect(branch).not.toContain("RISK")
    expect(branch).not.toContain("riskTone")
    expect(branch).not.toContain("confidence")
    expect(branch).not.toContain("%")
  })

  it("decides it from both halves of hasNoUsableResult, not from a missing diagnosis alone", () => {
    expect(code(HISTORY_CONSOLE)).toContain(
      "hasNoUsableResult({ status: entry.status, diagnosis: entry.diagnosis })",
    )
  })
})

describe("T044 — the operational projection carries no clinical content (FR-062)", () => {
  it("is a Server Component", () => {
    expect(code(OPERATIONS_PAGE)).not.toContain('"use client"')
  })

  it("never reads a clinical field off a row", () => {
    // Asserted as *access*, not as substring presence. The page legitimately
    // contains the word "diagnosis" twice — once passing `diagnosis: null` into
    // `hasNoUsableResult` to assert the absence, and once in the sentence a
    // reader sees. Neither reads a value. What must never appear is a read.
    const source = code(OPERATIONS_PAGE)
    for (const field of [
      "diagnosis",
      "confidence",
      "risk_level",
      "image_url",
      "image_name",
      "classification_metrics",
    ]) {
      expect(source, `reads ${field}`).not.toMatch(new RegExp(`\\w\\.${field}\\b`))
      expect(source, `destructures ${field}`).not.toMatch(new RegExp(`\\{[^}]*\\b${field}\\b[^}]*\\}\\s*=`))
    }
    expect(source).not.toContain("riskTone")
    // And the value was never fetched: the service hands this page operational
    // columns only, so nothing above could read a field even if it tried.
    expect(source).toContain("getOperationalCases")
    expect(source).not.toContain("getReviewQueue")
    expect(source).not.toContain("getCaseForClinician")
  })

  it("never reads a version's content or a review's note", () => {
    const source = code(OPERATIONS_PAGE)
    expect(source).not.toContain(".note")
    expect(source).not.toContain("sign_rationale")
    expect(source).not.toContain("content_digest")
    expect(source).not.toContain("storage_path")
  })

  it("renders existence, transitions with times, latency and attribution", () => {
    const source = code(OPERATIONS_PAGE)
    expect(source).toContain("processing_time")
    expect(source).toContain("claimed_at")
    expect(source).toContain("signed_by")
    expect(source).toContain("released_by")
    expect(source).toContain("clinician_id")
  })
})

describe("T045 — the operational surface has no clinical authority", () => {
  it("contains no form and no mutating control", () => {
    const source = code(OPERATIONS_PAGE)
    for (const forbidden of ["<form", "onClick", "onSubmit", "<Button", "useState"]) {
      expect(source, `found ${forbidden}`).not.toContain(forbidden)
    }
  })

  it("has no POST target under /api/clinical/ and issues no request at all", () => {
    const source = code(OPERATIONS_PAGE)
    expect(source).not.toContain("/api/clinical/")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain('method: "POST"')
  })

  it("imports no function that signs, decides or releases", () => {
    const source = code(OPERATIONS_PAGE)
    for (const forbidden of ["signVersion", "releaseVersion", "recordReview", "claimCase", "resumeReview"]) {
      expect(source, `imports ${forbidden}`).not.toContain(forbidden)
    }
  })
})

describe("T046 — the no-result path in the admin view", () => {
  it("shows the recorded reason a failed analysis produced nothing", () => {
    expect(code(OPERATIONS_PAGE)).toContain("error_message")
  })

  it("distinguishes a failed analysis from one that produced no diagnosis", () => {
    const text = rendered(OPERATIONS_PAGE)
    expect(text).toContain("No usable result — analysis failed")
    expect(text).toContain("No usable result — the analysis produced no diagnosis.")
  })

  it("styles neither as an alert", () => {
    const source = code(OPERATIONS_PAGE)

    // The no-result branch specifically. The page still uses `ErrorState` for a
    // genuine load failure, which is a different thing entirely — asserting the
    // string is absent from the whole file would forbid the one correct use.
    const start = source.indexOf("{noResult && (")
    expect(start).toBeGreaterThan(-1)
    const branch = source.slice(start, source.indexOf("</p>", start))

    expect(branch).not.toContain("ErrorState")
    expect(branch).not.toContain('role="alert"')
    expect(branch).not.toContain("text-critical")
    expect(branch).toContain("text-muted-foreground")
  })
})

describe("T047 — navigation", () => {
  it("adds one clinician entry and one admin entry", () => {
    expect(NAVIGATION).toContain('{ title: "Review queue", url: "/dashboard/queue", icon: IconInbox }')
    expect(NAVIGATION).toContain(
      '{ title: "Operations", url: "/dashboard/operations", icon: IconActivity }',
    )
  })

  it("puts neither in MAIN_NAV, so a patient sees neither", () => {
    const main = NAVIGATION.slice(
      NAVIGATION.indexOf("MAIN_NAV"),
      NAVIGATION.indexOf("CLINICIAN_NAV"),
    )
    expect(main).not.toContain("/dashboard/queue")
    expect(main).not.toContain("/dashboard/operations")
  })
})

describe("T048 — accessibility acceptance checks", () => {
  it("puts aria-live on the case status region", () => {
    expect(CASE_PAGE).toContain('aria-live="polite"')
  })

  it("puts it nowhere near the queue, which would announce on every poll", () => {
    expect(QUEUE_PAGE).not.toContain("aria-live")
    expect(OPERATIONS_PAGE).not.toContain("aria-live")
    expect(HISTORY_CONSOLE).not.toContain("aria-live")
  })

  it("uses polite and never assertive — a status change never cuts off a sentence", () => {
    expect(CASE_PAGE).not.toContain('aria-live="assertive"')
  })

  it("gives every action of this feature a 44px minimum target", () => {
    // `min-h-11` is 2.75rem = 44px. These are the only interactive controls the
    // feature adds; T041–T052 introduce no new action of their own, and the
    // surfaces below are asserted to contain none.
    const SIGN_DIALOG = read("../../components/clinical/sign-dialog.tsx")
    const DECISION_FORM = read("../../components/clinical/decision-form.tsx")

    for (const [name, source] of [
      ["sign-dialog", SIGN_DIALOG],
      ["decision-form", DECISION_FORM],
    ] as const) {
      const buttons = source.split("<Button").length - 1
      const sized = source.split("min-h-11").length - 1
      expect(sized, `${name}: ${buttons} buttons, ${sized} sized`).toBeGreaterThanOrEqual(buttons)
    }
  })

  it("lets focus follow DOM order — no positive tabIndex anywhere in the feature", () => {
    for (const [name, source] of [
      ["operations", OPERATIONS_PAGE],
      ["queue", QUEUE_PAGE],
      ["case", CASE_PAGE],
      ["version-panel", VERSION_PANEL],
    ] as const) {
      expect(source, `${name} sets tabIndex`).not.toMatch(/tabIndex=\{?["']?[1-9]/)
    }
  })
})
