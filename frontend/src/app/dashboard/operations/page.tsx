import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { IconClipboardList } from "@tabler/icons-react"

import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { EmptyState, ErrorState, PermissionDenied } from "@/components/clinical/states"
import { StatusBadge } from "@/components/clinical/status-badge"
import { hasNoUsableResult, presentCaseState } from "@/data/clinical/case-presentation"
import { getOperationalAttribution, getOperationalCases } from "@/services/clinical.server"
import { getSessionUser } from "@/services/auth.server"

export const metadata: Metadata = {
  title: "Operations",
  description: "Operational visibility over clinical review, without clinical content.",
}

export const dynamic = "force-dynamic"

/**
 * The admin projection. **Server Component** — no `"use client"` in this file.
 *
 * FR-062 and T022: existence, state transitions with times, analysis latency,
 * failures with their recorded reasons, and attribution for every decision,
 * signature and release — and **none** of the image, the diagnosis, the
 * confidence, the risk level, or any report content.
 *
 * That exclusion is enforced in the query, not here. `getOperationalCases`
 * selects `OPERATIONAL_COLUMNS` and `getOperationalAttribution` selects only the
 * attribution columns, so the clinical fields are never fetched — a later edit
 * to this file cannot leak what the page was never handed. Filtering in the
 * render body instead would leave the data one JSX line away from an operator.
 *
 * T045: this page offers **no** control that signs, decides, releases, or edits
 * evidence. There is no form, no mutating button, and no POST target under
 * `/api/clinical/` anywhere below. Operational oversight carries zero clinical
 * authority — an operator who could release a version would be signing off on a
 * finding they are, by design, not allowed to read.
 */
export default async function OperationsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/login")

  // Display gating only. `GET /api/clinical/*` re-checks every one of these with
  // `getSessionUser()` before it queries, and T022 is the assertion that matters
  // — this page being unreachable proves nothing about the data (FR-034).
  if (session.role !== "admin") {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Operations" />
        <PermissionDenied requiredRole="admin" />
      </div>
    )
  }

  const cases = await getOperationalCases()

  if (!cases.ok) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader title="Operations" />
        <ErrorState title="Couldn't load" body="The case list is unavailable right now." />
      </div>
    )
  }

  const attribution = await getOperationalAttribution(cases.data.map((row) => row.id))
  const attributionFor = (id: string) =>
    attribution.ok ? attribution.data[id] : undefined

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Operations"
        description="Case flow, timings and attribution. No clinical content."
      />

      {cases.data.length === 0 ? (
        <EmptyState icon={IconClipboardList} title="No cases" body="No case has entered clinical review yet." />
      ) : (
        <ul className="flex flex-col gap-4">
          {cases.data.map((row) => {
            const state = presentCaseState("admin", row.review_state)
            const noResult = hasNoUsableResult({ status: row.status, diagnosis: null })
            const own = attributionFor(row.id)

            return (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-foreground">{row.id}</span>
                  {state && <StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Fact term="Created" value={moment(row.created_at)} />
                  <Fact term="Last change" value={moment(row.updated_at)} />
                  <Fact term="Claimed" value={moment(row.claimed_at)} />
                  <Fact term="Analysis latency" value={latency(row.processing_time)} />
                </dl>

                {/*
                  T046. The recorded reason a case produced no usable result,
                  shown as a recorded fact and **not** styled as an alert — a
                  failed inference is an ordinary operational event, and an
                  operations list where every such row shouts is a list nobody
                  reads carefully (FR-042).

                  Two distinct causes, stated separately: the analysis failed and
                  left an `error_message`, or it completed and produced no
                  diagnosis. Collapsing them would hide which one happened.
                */}
                {noResult && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {row.status === "failed"
                      ? `No usable result — analysis failed. Recorded reason: ${
                          row.error_message ?? "none recorded"
                        }`
                      : "No usable result — the analysis produced no diagnosis."}
                  </p>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <section aria-label={`Decisions on case ${row.id}`}>
                    <SectionHeading title="Decisions" />
                    {!own || own.reviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None recorded.</p>
                    ) : (
                      <ol className="flex flex-col gap-1 text-sm">
                        {own.reviews.map((review) => (
                          <li key={review.id} className="text-muted-foreground">
                            {/*
                              `outcome` and `clinician_id` only. `note` was never
                              selected — it is the clinician's free text and is
                              the one place a finding can live (Constitution II).
                            */}
                            {review.outcome === "more_data_requested"
                              ? "More data requested"
                              : "Decision recorded"}{" "}
                            by {review.clinician_id} on {moment(review.created_at)}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section aria-label={`Versions on case ${row.id}`}>
                    <SectionHeading title="Signatures and releases" />
                    {!own || own.versions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No version exists.</p>
                    ) : (
                      <ol className="flex flex-col gap-1 text-sm">
                        {own.versions.map((version) => (
                          <li key={version.id} className="text-muted-foreground">
                            v{version.version_number} —{" "}
                            {version.signed_by
                              ? `signed by ${version.signed_by} on ${moment(version.signed_at)}`
                              : "unsigned"}
                            {version.released_by
                              ? `; released by ${version.released_by} on ${moment(
                                  version.released_at
                                )}`
                              : "; not released"}
                            {version.correction_started_by
                              ? `; correction started by ${version.correction_started_by} on ${moment(
                                  version.correction_started_at
                                )}`
                              : ""}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </li>
            )
          })}
        </ul>
      )}
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

function moment(iso: string | null | undefined): string {
  if (!iso) return "—"
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleString()
}

/** Milliseconds as the row stores them. "—" when nothing was recorded, never "0 ms". */
function latency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—"
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}
