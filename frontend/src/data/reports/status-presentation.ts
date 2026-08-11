/**
 * How each report status is shown. Data and pure functions only — no JSX.
 *
 * One table, so the chip in the console, the row description and the empty-state
 * copy cannot drift into describing the same row three different ways. Composition
 * is D17: label + colour + icon on every chip, icons `aria-hidden`, the label as
 * the accessible name.
 *
 * `degraded` is amber, not red, deliberately: the report exists and is usable, and
 * Preview and Download stay offered for it (D20).
 */

import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { NARRATIVE_SECTIONS, type ReportStatus, type SectionsGenerated } from "@/lib/reports/contract"

/**
 * `"stale"` is not a stored status. It is a `generating` row older than
 * `REPORT_STALE_MS`, decided at read time by `isStale()` — no transition exists
 * when the observer dies mid-generation (D9).
 */
export type ReportPresentationKey = ReportStatus | "stale"

export interface StatusPresentation {
  label: string
  chipClass: string
  icon: LucideIcon
  description: string
}

export const STATUS_PRESENTATION: Record<ReportPresentationKey, StatusPresentation> = {
  completed: {
    label: "Ready",
    chipClass: "bg-success-subtle text-success",
    icon: CheckCircle2,
    description: "The report is ready to preview or download.",
  },
  degraded: {
    label: "Incomplete",
    chipClass: "bg-warning-subtle text-warning",
    icon: AlertTriangle,
    description:
      "Some sections could not be generated. The rest of the report is still usable.",
  },
  generating: {
    label: "Generating…",
    chipClass: "bg-muted text-muted-foreground",
    icon: Loader2,
    description: "You can leave this page — it'll be here when you get back.",
  },
  // No row is written with `pending` today: the orchestrator inserts `generating`
  // directly. It stays in the contract as a legal pre-start state, and until
  // something writes it there is nothing truthful to say that differs from
  // `generating`, so it borrows that presentation rather than inventing a label.
  pending: {
    label: "Generating…",
    chipClass: "bg-muted text-muted-foreground",
    icon: Loader2,
    description: "You can leave this page — it'll be here when you get back.",
  },
  stale: {
    label: "Didn't finish",
    chipClass: "bg-muted text-muted-foreground",
    icon: CircleSlash,
    description: "This report stopped part-way through. You can generate it again.",
  },
  failed: {
    label: "Couldn't be generated",
    chipClass: "bg-destructive-subtle text-destructive",
    icon: XCircle,
    description: "Nothing was saved on your end. You can generate it again.",
  },
}

/**
 * Presentation for a row, falling back to its own stored value.
 *
 * A historical row may carry a status outside the closed set. It is displayed
 * verbatim and treated as terminal, never rewritten (Assumption 2).
 */
export function presentStatus(
  status: string,
  { stale = false }: { stale?: boolean } = {}
): StatusPresentation {
  if (stale && status === "generating") return STATUS_PRESENTATION.stale

  const known = STATUS_PRESENTATION[status as ReportPresentationKey]
  if (known) return known

  return {
    label: status,
    chipClass: "bg-muted text-muted-foreground",
    icon: CircleSlash,
    description: "This report predates the current status vocabulary.",
  }
}

/**
 * The absent narrative sections, as a phrase a person can read.
 *
 * Three outcomes, deliberately distinct:
 *   `null` provenance  → says so. A historical row records nothing about what was
 *                        generated, and unknown must never render as complete
 *                        (Assumption 2).
 *   nothing missing    → `""`, so a caller can test truthiness.
 *   otherwise          → "observations, recommendations and limitations".
 */
export function missingSections(sectionsGenerated: SectionsGenerated | null): string {
  if (!sectionsGenerated) return "which sections were generated was not recorded"

  const missing = NARRATIVE_SECTIONS.filter((section) => !sectionsGenerated[section])
  if (missing.length === 0) return ""
  if (missing.length === 1) return missing[0]

  return `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
}
