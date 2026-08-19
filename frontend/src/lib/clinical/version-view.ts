/**
 * How a report version's *document* reads, given the version row and what the
 * store actually holds. Pure — no Supabase client, no React, no I/O.
 *
 * T050 (FR-024) and T052 (D1) are one derivation and not two. Both ask the same
 * question of the same row — what does this signed version's stored document
 * look like right now — and answering it twice lets the patient view and the
 * clinician view disagree about a single case. The service performs the probe;
 * this module decides what the pair means and what a person is told.
 *
 * WHAT THE DIGEST PROVES, AND WHAT IT DOES NOT (FR-054, E9/H5). It detects that
 * the stored document drifted from what was signed. It does not prove who
 * changed it, when, or why, and nothing here may describe it as cryptographic
 * verification. The copy below therefore states the fact and stops: the document
 * changed. No actor, no intent, no claim of security.
 */

import type { StatusTone } from "@/components/clinical/status-badge"
import type { Presentation } from "@/data/clinical/case-presentation"

/** What the store returned for a version's `storage_path`. */
export interface DocumentProbe {
  /** Whether an object was retrieved at all. A null path is `found: false`. */
  found: boolean
  /** `sha256:…` over the retrieved bytes, or null when nothing was retrieved. */
  digest: string | null
}

export const VERSION_DOCUMENT_STATES = [
  "unsigned",
  "document_ok",
  "document_unavailable",
  "document_changed",
] as const

export type VersionDocumentState = (typeof VERSION_DOCUMENT_STATES)[number]

/** The three fields this decision rests on. Deliberately narrower than `ReportVersionRow`. */
export interface VersionDocumentInput {
  signed_at: string | null
  content_digest: string | null
  storage_path: string | null
}

/**
 * The four readings, in the order they are decided.
 *
 * **Order is the whole correctness argument.** `unsigned` is checked first
 * because an unsigned version has nothing to compare against and no signature to
 * report. Everything after it describes the *document* of a version whose
 * signature is a fact already established — which is what makes T050's rule
 * expressible at all: a missing file must never read as a missing signature.
 *
 * `content_digest === null` on a signed version is not a fault. T029 records it
 * that way when no PDF existed at signature time, and the signature still covers
 * `content`. With nothing recorded to compare against, a retrieved document
 * cannot be said to have changed — so it reads `document_ok`, never
 * `document_changed`. Treating an absent digest as a mismatch would accuse every
 * legitimately document-less signature of having drifted.
 */
export function versionDocumentState(
  version: VersionDocumentInput,
  probe: DocumentProbe,
): VersionDocumentState {
  if (!version.signed_at) return "unsigned"
  if (!probe.found) return "document_unavailable"
  if (version.content_digest === null) return "document_ok"
  return probe.digest === version.content_digest ? "document_ok" : "document_changed"
}

/**
 * The copy. One voice for both roles here — unlike the case states, where a
 * patient and a clinician need genuinely different sentences, these four say the
 * same thing to anyone: what exists, and what could not be produced.
 *
 * No string below says verified, secure, tamper-proof, or authentic (FR-054).
 */
export const VERSION_DOCUMENT_PRESENTATION: Record<VersionDocumentState, Presentation> = {
  unsigned: {
    label: "Not signed yet",
    description: "This version has not been signed.",
    tone: "neutral",
  },
  document_ok: {
    label: "Signed",
    description: "Signed and available to read.",
    tone: "success",
  },
  document_unavailable: {
    // Says nothing about the signature, because the signature is intact and is
    // rendered beside this from the row's own `signed_by` and `signed_at`.
    label: "Document unavailable",
    description: "The signature is on record. The document itself could not be retrieved.",
    tone: "warning",
  },
  document_changed: {
    // States the fact and stops. Not "tampered with", not "detected", not an
    // actor — none of which this comparison establishes.
    label: "Does not match what was signed",
    description:
      "The stored document does not match what was signed. Ask the clinician who signed it for a current copy.",
    tone: "warning",
  },
}

export function presentVersionDocument(state: VersionDocumentState): Presentation {
  return VERSION_DOCUMENT_PRESENTATION[state]
}

/**
 * Whether a person may read the document itself.
 *
 * Both refusing states are readable-as-status but not as a document: one has no
 * bytes to serve, and the other has bytes nobody should be handed as though they
 * were the signed artifact.
 */
export function documentIsReadable(state: VersionDocumentState): boolean {
  return state === "document_ok"
}

/** The tone the panel's badge carries. Re-exported so a caller needs one import. */
export type { StatusTone }
