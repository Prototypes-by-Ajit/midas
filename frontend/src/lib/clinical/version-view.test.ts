/**
 * T050 (FR-024) and T052 (D1) — the two named assertions about a signed
 * version's document, against the one derivation both surfaces use.
 *
 * These are real assertions, not source reads: `versionDocumentState` is pure,
 * so the whole decision is checkable without a DOM. What still needs a rendered
 * tree — that the signature block and the document notice appear together on a
 * page — is asserted structurally in `surfaces.test.ts`, and the limit is stated
 * there.
 */

import { describe, expect, it } from "vitest"

import {
  VERSION_DOCUMENT_PRESENTATION,
  VERSION_DOCUMENT_STATES,
  documentIsReadable,
  presentVersionDocument,
  versionDocumentState,
} from "./version-view"

const SIGNED = {
  signed_at: "2026-08-18T10:00:00.000Z",
  content_digest: "sha256:abc",
  storage_path: "user_1/reports/r1.pdf",
}

describe("T050 — signature intact, document unavailable (FR-024)", () => {
  it("reads as document_unavailable when the stored object cannot be retrieved", () => {
    expect(versionDocumentState(SIGNED, { found: false, digest: null })).toBe(
      "document_unavailable",
    )
  })

  it("reads as document_unavailable when storage_path is null, not as unsigned", () => {
    expect(
      versionDocumentState({ ...SIGNED, storage_path: null }, { found: false, digest: null }),
    ).toBe("document_unavailable")
  })

  it("never says 'unsigned' or 'no such version' — a missing file is not a missing signature", () => {
    const copy = VERSION_DOCUMENT_PRESENTATION.document_unavailable
    const text = `${copy.label} ${copy.description}`.toLowerCase()

    expect(text).not.toContain("unsigned")
    expect(text).not.toContain("no such version")
    // States the signature positively, so the surface cannot read as unsigned.
    expect(text).toContain("signature")
  })

  it("keeps the signature independent of the document: only the document state changes", () => {
    const retrievable = versionDocumentState(SIGNED, { found: true, digest: "sha256:abc" })
    const missing = versionDocumentState(SIGNED, { found: false, digest: null })

    expect(retrievable).toBe("document_ok")
    expect(missing).toBe("document_unavailable")
    // Neither is `unsigned` — that reading is reachable only from signed_at.
    expect([retrievable, missing]).not.toContain("unsigned")
  })
})

describe("T052 — the digest-mismatch path (D1)", () => {
  it("reads as document_changed when the stored bytes hash differently", () => {
    expect(versionDocumentState(SIGNED, { found: true, digest: "sha256:different" })).toBe(
      "document_changed",
    )
  })

  it("reads as document_ok when the digests agree", () => {
    expect(versionDocumentState(SIGNED, { found: true, digest: "sha256:abc" })).toBe("document_ok")
  })

  it("does not accuse a signature that recorded no digest", () => {
    // T029 stores a null digest when no PDF existed at signature time. With
    // nothing recorded to compare against, nothing can be said to have drifted.
    expect(
      versionDocumentState(
        { ...SIGNED, content_digest: null },
        { found: true, digest: "sha256:whatever" },
      ),
    ).toBe("document_ok")
  })

  it("says the document changed without claiming who, or how it was detected (FR-054)", () => {
    const copy = VERSION_DOCUMENT_PRESENTATION.document_changed
    const text = `${copy.label} ${copy.description}`.toLowerCase()

    expect(text).toContain("does not match what was signed")
    for (const forbidden of [
      "cryptograph",
      "verified",
      "verify",
      "secure",
      "tamper",
      "authentic",
      "hash",
      "digest",
      "checksum",
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })

  it("refuses to hand over a changed document as though it were the signed one", () => {
    expect(documentIsReadable("document_changed")).toBe(false)
    expect(documentIsReadable("document_unavailable")).toBe(false)
    expect(documentIsReadable("document_ok")).toBe(true)
  })
})

describe("the derivation as a whole", () => {
  it("returns unsigned before it looks at the document at all", () => {
    // An unsigned version has no signature to report and nothing to compare, so
    // neither the probe result nor a recorded digest may change this answer.
    expect(
      versionDocumentState(
        { signed_at: null, content_digest: "sha256:abc", storage_path: "p" },
        { found: false, digest: null },
      ),
    ).toBe("unsigned")
    expect(
      versionDocumentState(
        { signed_at: null, content_digest: "sha256:abc", storage_path: "p" },
        { found: true, digest: "sha256:different" },
      ),
    ).toBe("unsigned")
  })

  it("gives every state copy, and no two states the same copy", () => {
    const labels = VERSION_DOCUMENT_STATES.map((s) => presentVersionDocument(s).label)

    expect(labels).toHaveLength(VERSION_DOCUMENT_STATES.length)
    expect(new Set(labels).size).toBe(labels.length)
    for (const state of VERSION_DOCUMENT_STATES) {
      const copy = presentVersionDocument(state)
      expect(copy.label.trim()).not.toBe("")
      expect(copy.description.trim()).not.toBe("")
    }
  })

  it("says nothing anywhere that claims verification or security (FR-054)", () => {
    const all = VERSION_DOCUMENT_STATES.map((s) => {
      const c = presentVersionDocument(s)
      return `${c.label} ${c.description}`
    })
      .join(" ")
      .toLowerCase()

    for (const forbidden of ["verified", "secure", "tamper-proof", "tamper proof", "authentic"]) {
      expect(all).not.toContain(forbidden)
    }
  })
})
