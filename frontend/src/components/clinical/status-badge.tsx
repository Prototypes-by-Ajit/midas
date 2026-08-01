import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The single source of truth for status colour in the dashboard.
 *
 * Every surface — analyses, reports, documents, sessions, service health — maps
 * its own vocabulary onto one of four tones, so "completed" looks identical
 * everywhere and no page hand-writes `bg-green-100 text-green-800 dark:...`.
 *
 * Server Component: it renders a span, holds no state.
 */
const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-muted-foreground",
        success: "border-success/25 bg-success-subtle text-success",
        warning: "border-warning/25 bg-warning-subtle text-warning",
        critical: "border-critical/25 bg-critical-subtle text-critical",
        active: "border-primary/25 bg-primary-subtle text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>

export function StatusBadge({
  tone,
  dot = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Leading status dot. Colour is inherited, so it never needs its own class. */
    dot?: boolean
  }) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  )
}

/**
 * Risk level is the one place where colour carries clinical meaning, so the
 * mapping lives here rather than being re-derived per page.
 */
export function riskTone(risk: string | null | undefined): StatusTone {
  switch (risk?.toLowerCase()) {
    case "high":
      return "critical"
    case "medium":
    case "moderate":
      return "warning"
    case "low":
      return "success"
    default:
      return "neutral"
  }
}

/** Processing/lifecycle status shared by analyses, reports and documents. */
export function processTone(status: string | null | undefined): StatusTone {
  switch (status?.toLowerCase()) {
    case "completed":
    case "complete":
    case "indexed":
    case "ready":
    case "operational":
      return "success"
    case "processing":
    case "pending":
    case "queued":
    case "uploading":
    case "degraded":
      return "warning"
    case "failed":
    case "error":
    case "rejected":
    case "offline":
      return "critical"
    default:
      return "neutral"
  }
}
