/**
 * T039 [US3] — the irreversibility copy, to the word.
 *
 * WHAT THIS SUITE CAN AND CANNOT CHECK, stated up front so a green run is not
 * read as more than it is.
 *
 * `vitest.config.ts` sets `environment: "node"`. There is no jsdom and no
 * `@testing-library/react` in this repo, so **nothing here renders the component**.
 * Two of T039's properties are therefore asserted differently than a DOM test
 * would assert them:
 *
 *   "the string is present in the DOM **before** the confirm button is enabled"
 *       → asserted structurally instead. `SIGN_DIALOG_COPY.description` is
 *         rendered unconditionally inside `DialogContent`, in the same subtree as
 *         the confirm button and earlier in DOM order, with no state gating it.
 *         The source assertion below fails if a conditional is introduced around
 *         it. **A real render test needs jsdom, which this repo does not have —
 *         adding it is its own task, not a detail of this one.**
 *
 *   "no string in this component says verified, secure, or tamper-proof"
 *       → asserted over `SIGN_DIALOG_COPY` AND over the file as text, the
 *         second because a banned word could reach a screen from a string literal
 *         that never passed through `SIGN_DIALOG_COPY`. Reading a source file as
 *         text is the technique `backend/tests/test_clinical_contract.py` already
 *         uses for the same reason: there is no build step to hook.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { SIGN_DIALOG_COPY } from "@/data/clinical/sign-copy"

const source = readFileSync(fileURLToPath(new URL("./sign-dialog.tsx", import.meta.url)), "utf8")

/**
 * The component with its commentary removed.
 *
 * Every assertion about what the component *says* or *imports* runs against this
 * rather than the raw file, because the file's own comments name the banned
 * wording and the banned package in order to explain why they are banned. A check
 * that flagged its own rationale would be deleted rather than fixed.
 */
const code = source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")

describe("the sign confirmation copy", () => {
  it("uses the exact heading and buttons T039 specifies", () => {
    expect(SIGN_DIALOG_COPY.title).toBe("Sign this report version?")
    expect(SIGN_DIALOG_COPY.cancel).toBe("Cancel")
    expect(SIGN_DIALOG_COPY.confirm).toBe("Sign report")
  })

  it("uses the exact body T039 specifies", () => {
    expect(SIGN_DIALOG_COPY.description).toBe(
      "Signing attaches your name to this version permanently. It cannot be undone or edited. " +
        "If a correction is needed later, you'll sign a new version instead.",
    )
  })

  it("carries the phrase 'cannot be undone'", () => {
    // The named assertion. This clause is the whole reason the dialog exists —
    // a confirmation that does not say what is irreversible is a speed bump.
    expect(SIGN_DIALOG_COPY.description).toContain("cannot be undone")
    expect(SIGN_DIALOG_COPY.irreversible).toContain("cannot be undone")
  })

  it("renders the description unconditionally, so it cannot appear after the button", () => {
    // Structural stand-in for the DOM-ordering half of the named assertion.
    // `DialogDescription` sits inside `DialogHeader`, which precedes
    // `DialogFooter` — and neither is behind a conditional.
    const description = code.slice(
      code.indexOf("<DialogDescription>"),
      code.indexOf("</DialogDescription>"),
    )
    expect(description, "the description element is missing").not.toBe("")
    // The irreversible clause reaches the screen through the copy module, so the
    // reference is what the markup carries — asserting the literal here would
    // pass only until the copy was centralised, which is what just happened.
    expect(description).toContain("SIGN_DIALOG_COPY.irreversible")

    // The description must come before the confirm button in source order.
    expect(code.indexOf("<DialogDescription>")).toBeLessThan(code.indexOf("<DialogFooter>"))

    // No `&&` or ternary gating the description block.
    const header = code.slice(code.indexOf("<DialogHeader>"), code.indexOf("</DialogHeader>"))
    expect(header).not.toMatch(/\{[^}]*&&\s*<DialogDescription/)
    expect(header).not.toMatch(/\?\s*<DialogDescription/)
  })
})

describe("FR-054 — no claim this system cannot support", () => {
  const BANNED = /verified|verification|secure|tamper|cryptograph|guarantee|proof of/i

  it("says none of it in the exported copy", () => {
    for (const [key, value] of Object.entries(SIGN_DIALOG_COPY)) {
      expect(value, `SIGN_DIALOG_COPY.${key}`).not.toMatch(BANNED)
    }
  })

  it("says none of it in any rendered string in the file", () => {
    // Against `code`, not `source`: a banned word could reach a screen from a
    // string literal that never passed through SIGN_DIALOG_COPY.
    const matches = code.match(BANNED)
    expect(matches, `banned wording reaches the screen: ${matches?.[0]}`).toBeNull()
  })
})

describe("G2 — how the dialog is built", () => {
  it("prevents outside dismissal but leaves Escape alone", () => {
    expect(code).toContain("onInteractOutside")
    expect(code).toContain("onPointerDownOutside")
    expect(code).toMatch(/onInteractOutside=\{\(event\) => event\.preventDefault\(\)\}/)
    // Escape must still cancel. Overriding `onEscapeKeyDown` is the way that
    // breaks, so its absence is the assertion.
    expect(code).not.toContain("onEscapeKeyDown")
  })

  it("announces as an alert dialog without adding a second Radix package", () => {
    expect(code).toContain('role="alertdialog"')
    // G2 forbids `@radix-ui/react-alert-dialog`; it is not installed, and this
    // fails loudly if someone adds the import rather than the prop.
    expect(code).not.toContain("react-alert-dialog")
  })
})
