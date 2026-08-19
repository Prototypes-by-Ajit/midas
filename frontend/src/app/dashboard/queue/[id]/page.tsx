import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"

import { DecisionForm } from "@/components/clinical/decision-form"
import { NotADiagnosisNotice } from "@/components/clinical/medical-disclaimer"
import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { PermissionDenied } from "@/components/clinical/states"
import { StatusBadge } from "@/components/clinical/status-badge"
import {
  hasNoUsableResult,
  presentCaseState,
  presentSharedState,
} from "@/data/clinical/case-presentation"
import { VersionPanel } from "@/components/clinical/version-panel"
import {
  describeVersionDocument,
  getCaseForClinician,
  getCaseReviews,
  getCaseVersions,
} from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

export const metadata: Metadata = {
  title: "Case review",
  description: "Evidence and decision history for a case under review.",
}

export const dynamic = "force-dynamic"

/**
 * One case, as the reviewing clinician sees it. **Server Component** — the only
 * client code on this route is `DecisionForm`.
 *
 * FR-050 is the constraint that shapes every line below: a machine-produced
 * score must not be presented as a clinical finding. The model's output is
 * therefore rendered inside a section titled "Model output", with each value
 * labelled by what produced it, and no sentence anywhere states a conclusion.
 * The word "diagnosis" does not appear as a heading; "Model's top label" does,
 * because that is what the column holds.
 *
 * `detected_features` is not read at all — `report_generator.py` already excludes
 * it because it carries pipeline placeholders rather than measurements, and
 * showing a placeholder to a clinician reviewing a lesion is worse than showing
 * nothing.
 *
 * A case held by another clinician 404s in the service and renders as denied
 * here, with wording that does not disclose whether the case exists (FR-031).
 */
export default async function CaseReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSessionUser()
  if (!session) redirect("/login")

  if (session.role !== "clinician") {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Case review" />
        <PermissionDenied requiredRole="clinician" />
      </div>
    )
  }

  const found = await getCaseForClinician(id, session.userId)

  if (!found.ok) {
    const cell = presentSharedState(
      "clinician",
      found.reason === "unavailable" ? "error" : "denied",
    )
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Case review" crumbs={[{ label: "Review queue", href: "/dashboard/queue" }]} />
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-foreground">{cell.label}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {cell.description}
          </p>
        </div>
      </div>
    )
  }

  const [reviews, versions] = await Promise.all([
    getCaseReviews(id, true),
    getCaseVersions(id, true),
  ])

  // T050/T052. One probe per version, on a detail surface only — the queue never
  // does this. `describeVersionDocument` short-circuits an unsigned version
  // without touching storage, so a case mid-review costs nothing here.
  const versionViews = versions.ok
    ? await Promise.all(
        versions.data.map(async (version) => ({
          version,
          documentState: await describeVersionDocument(version),
        })),
      )
    : []

  const record = found.data
  const state = presentCaseState("clinician", record.review_state)
  const noResult = hasNoUsableResult({ status: record.status, diagnosis: record.diagnosis })
  const mine = record.claimed_by === session.userId

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Case review"
        description={`Case ${id.slice(0, 8)}, submitted ${new Date(record.created_at).toLocaleString()}.`}
        crumbs={[{ label: "Review queue", href: "/dashboard/queue" }, { label: "Case" }]}
        action={
          state ? (
            /*
              T048. `aria-live="polite"` belongs HERE and nowhere else: one case,
              whose status changes underneath the reader when they claim it,
              record a decision, or sign. The queue deliberately has none — it
              re-renders on every visit, and a live region over a work list would
              read the whole thing aloud each time.

              `polite`, not `assertive`: a status change is worth hearing at the
              next pause, never worth cutting off the sentence in progress.
            */
            <span aria-live="polite">
              <StatusBadge tone={state.tone} dot>
                {state.label}
              </StatusBadge>
            </span>
          ) : null
        }
      />

      {state && <p className="text-sm text-muted-foreground">{state.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="evidence-heading">
            <SectionHeading id="evidence-heading" title="Image" />
            <div className="overflow-hidden rounded-xl border bg-card">
              {record.image_url ? (
                <Image
                  src={record.image_url}
                  alt={
                    record.image_name
                      ? `Dermoscopic image submitted for this case: ${record.image_name}`
                      : "Dermoscopic image submitted for this case"
                  }
                  width={640}
                  height={640}
                  className="h-auto w-full object-contain"
                  unoptimized
                />
              ) : (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No image is stored for this case.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="intake-heading">
            <SectionHeading id="intake-heading" title="Intake" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm">
              <Fact term="Submitted" value={new Date(record.created_at).toLocaleString()} />
              <Fact term="File" value={record.image_name ?? "Not recorded"} />
              <Fact
                term="Analysis time"
                value={
                  record.processing_time
                    ? `${Math.round(record.processing_time / 1000)}s`
                    : "Not recorded"
                }
              />
              <Fact term="Held by" value={mine ? "You" : "Unclaimed"} />
            </dl>
          </section>

          <ModelOutput
            noResult={noResult}
            status={record.status ?? null}
            errorMessage={record.error_message ?? null}
            diagnosis={record.diagnosis ?? null}
            confidence={record.confidence ?? null}
            riskLevel={record.risk_level ?? null}
          />

          <NotADiagnosisNotice />
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="decision-heading">
            <SectionHeading id="decision-heading" title="Record a decision" />
            <div className="rounded-xl border bg-card p-4">
              {mine ? (
                <DecisionForm caseId={id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Claim this case before recording a decision. Claiming takes it off
                  everyone else&apos;s list.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="history-heading">
            <SectionHeading id="history-heading" title="Decision history" />
            <div className="rounded-xl border bg-card p-4">
              {!reviews.ok ? (
                <p className="text-sm text-muted-foreground">
                  {presentSharedState("clinician", "error").description}
                </p>
              ) : reviews.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing recorded yet.
                </p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {reviews.data.map((review) => (
                    <li key={review.id} className="border-l-2 border-border pl-3">
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleString()} ·{" "}
                        {review.outcome === "more_data_requested"
                          ? "Requested more information"
                          : "Recorded a decision"}
                      </p>
                      {/* Rendered as text, never as HTML (E5). React escapes it. */}
                      {review.note && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {review.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section aria-labelledby="versions-heading">
            <SectionHeading id="versions-heading" title="Report versions" />
            <div className="rounded-xl border bg-card p-4">
              {versionViews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No version exists yet. Recording a decision creates version 1.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {versionViews.map(({ version, documentState }) => (
                    <li key={version.id}>
                      <VersionPanel
                        versionNumber={version.version_number}
                        documentState={documentState}
                        signedBy={version.signed_by}
                        signedAt={version.signed_at}
                        releasedAt={version.released_at}
                        correctionStartedAt={version.correction_started_at}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  )
}

/**
 * The model's output, labelled as the model's output (FR-050).
 *
 * Every value here is attributed to the model in the surrounding text, and no
 * value is stated as a conclusion. "Model's top label" rather than "Diagnosis";
 * "Model's score for that label" rather than "Confidence". The distinction is
 * not cosmetic — a clinician reading "Diagnosis: melanoma, 91%" has been handed
 * a finding by a system that produced a classification.
 *
 * T037: when there is no usable result, this renders as a normal outcome — a
 * plain panel with the same border as every other, no critical tone, no
 * `ErrorState`. The CNN never declines, so "no result" here means `failed` or a
 * null diagnosis, and both mean the same thing to the person reading: nobody has
 * an automated answer, so yours is the only one (FR-042, SC-006).
 */
function ModelOutput({
  noResult,
  status,
  errorMessage,
  diagnosis,
  confidence,
  riskLevel,
}: {
  noResult: boolean
  status: string | null
  errorMessage: string | null
  diagnosis: string | null
  confidence: number | null
  riskLevel: string | null
}) {
  const cell = presentSharedState("clinician", "no_result")

  return (
    <section aria-labelledby="model-heading">
      <SectionHeading id="model-heading" title="Model output" />
      <div className="rounded-xl border bg-card p-4">
        {noResult ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{cell.description}</p>
            <p className="text-sm text-muted-foreground">
              {status === "failed"
                ? "The automated step did not complete."
                : "The automated step completed without producing a label."}
              {errorMessage ? ` Recorded reason: ${errorMessage}` : ""}
            </p>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact term="Model's top label" value={diagnosis ?? "None"} />
            <Fact
              term="Model's score for that label"
              value={confidence === null ? "Not recorded" : `${Math.round(confidence * 100)}%`}
            />
            <Fact term="Model's risk tier" value={riskLevel ?? "Not recorded"} />
            <Fact term="Inference status" value={status ?? "Not recorded"} />
          </dl>
        )}
      </div>
    </section>
  )
}
