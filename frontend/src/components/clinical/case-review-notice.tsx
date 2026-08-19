import { NotADiagnosisNotice } from "@/components/clinical/medical-disclaimer"
import { StatusBadge } from "@/components/clinical/status-badge"
import { presentCaseState } from "@/data/clinical/case-presentation"
import type { UserRole } from "@/contexts/role-context"
import { cn } from "@/lib/utils"

/**
 * The clinical-review element on a surface that already existed before this
 * feature — currently the patient's history console.
 *
 * G3, AND THE REASON THIS IS A COMPONENT RATHER THAN AN INLINE BLOCK:
 * **when `review_state` is NULL this renders nothing at all.** No badge, no
 * section, no wrapper, no empty div. The analysis predates clinical review, the
 * case never entered the pipeline, and there is nothing truthful to say about a
 * review that never happened. "Unknown" printed on someone's own medical result
 * reads as a fault to the person it is about.
 *
 * That property is what makes T040's named assertion — a historical analysis
 * renders byte-identically to its pre-feature output — checkable rather than
 * aspirational: `presentCaseState("patient", null)` returns `null`, this returns
 * `null`, and React renders nothing. The one call site adds exactly one element
 * to the tree, and only when there is a review to describe.
 *
 * Holds no state and no handler, so it renders on the server where its caller
 * does. The history console is a client component today, which makes this one
 * client by inheritance — nothing here depends on that either way.
 */
export function CaseReviewNotice({
  role,
  reviewState,
  /** The clinician's verbatim ask (FR-006). Rendered as the primary content, not a badge. */
  requestedAction,
  className,
}: {
  role: UserRole
  reviewState: string | null | undefined
  requestedAction?: string | null
  className?: string
}) {
  const cell = presentCaseState(role, reviewState)

  // The whole of G3, in one line.
  if (!cell) return null

  const asking = reviewState === "more_data_requested" && Boolean(requestedAction)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        {/* The label is the accessible name; the tone only tints it (FR-041). */}
        <StatusBadge tone={cell.tone} dot>
          {cell.label}
        </StatusBadge>
      </div>

      <p className="text-sm text-muted-foreground">{cell.description}</p>

      {asking && (
        /*
          FR-006: the specific ask, verbatim from `case_reviews.note`, as the
          primary content. Rendered as text — React escapes it, and it is
          clinician-authored free text reaching a patient (E5).
        */
        <blockquote className="border-l-2 border-warning/50 pl-3 text-sm whitespace-pre-wrap text-foreground">
          {requestedAction}
        </blockquote>
      )}

      {/*
        FR-053: released patient-facing content keeps its screening-tool framing.
        The existing notice is reused rather than new disclaimer copy being
        written beside it — one wording, one place.
      */}
      {reviewState === "released" && <NotADiagnosisNotice className="mt-1" />}
    </div>
  )
}
