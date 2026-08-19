import { StatusBadge } from "@/components/clinical/status-badge"
import { presentVersionDocument } from "@/lib/clinical/version-view"
import type { VersionDocumentState } from "@/lib/clinical/version-view"

/**
 * One report version, as both the patient and the clinician see it.
 *
 * **Server Component** — no `"use client"`. It renders text and a badge, holds
 * no state, and performs no I/O: the caller resolves `documentState` with
 * `describeVersionDocument()` and passes the answer in. That split is what keeps
 * the digest comparison on detail surfaces only; a component that probed for
 * itself would pull a stored PDF for every row a list ever renders.
 *
 * Two views, one component, deliberately (T050, T052). Both are asking what this
 * signed version's document looks like right now, and two implementations would
 * eventually answer differently for the same row — which is the failure that
 * matters most here, because the disagreement would be invisible to whichever
 * person was looking at only one of them.
 */
export interface VersionPanelProps {
  versionNumber: number
  documentState: VersionDocumentState
  signedBy: string | null
  signedAt: string | null
  releasedAt: string | null
  correctionStartedAt: string | null
}

/**
 * The under-revision line, verbatim from FR-029 / T042.
 *
 * Exported so a test can assert the copy without rendering, and so no caller
 * writes a second version of a sentence a patient reads at the least reassuring
 * moment in the whole flow.
 */
export const UNDER_REVISION_NOTICE =
  "A clinician is revising this report. The version below is the one currently released."

function formatMoment(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? null : at.toLocaleString()
}

export function VersionPanel({
  versionNumber,
  documentState,
  signedBy,
  signedAt,
  releasedAt,
  correctionStartedAt,
}: VersionPanelProps) {
  const document = presentVersionDocument(documentState)
  const signedMoment = formatMoment(signedAt)
  const releasedMoment = formatMoment(releasedAt)

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {/*
        SC-012. The correction notice sits ABOVE the version and never replaces
        it: a corrected version keeps its `released_at` and stays readable while
        the replacement is drafted (migration 015, FR-029). Swapping the panel
        for this notice would create exactly the interval the criterion forbids —
        one where the patient sees nothing.
      */}
      {correctionStartedAt && (
        <p className="text-sm text-warning">{UNDER_REVISION_NOTICE}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Version {versionNumber}</span>
        <StatusBadge tone={document.tone}>{document.label}</StatusBadge>
      </div>

      <p className="text-sm text-muted-foreground">{document.description}</p>

      {/*
        FR-024, and the whole point of T050. The signature is rendered from the
        row's own columns and is INDEPENDENT of whether the document came back —
        so a missing file states that the file is missing while the signature
        stays attributed above it. A signature block that disappeared with the
        document would make a storage failure read as an unsigned report.
      */}
      {signedBy && (
        <p className="text-sm text-foreground">
          Signed by {signedBy}
          {signedMoment ? ` on ${signedMoment}` : null}.
        </p>
      )}

      {releasedMoment && (
        <p className="text-sm text-muted-foreground">Released {releasedMoment}.</p>
      )}
    </div>
  )
}
