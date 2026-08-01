import Link from "next/link"
import { IconChevronRight, IconHistory } from "@tabler/icons-react"

import { EmptyState } from "@/components/clinical/states"
import { StatusBadge, processTone, riskTone } from "@/components/clinical/status-badge"
import { Button } from "@/components/ui/button"
import type { RecentActivityItem } from "@/types/dashboard"

/**
 * Server Component. Timestamps are rendered as absolute UTC-stable text rather
 * than "3 hours ago" so server and client markup cannot disagree at hydration,
 * and so a clinical record never shows a relative time that silently ages.
 */
export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        title="No activity yet"
        body="Analyses and reports will appear here as you create them."
        action={
          <Button asChild size="sm">
            <Link href="/dashboard/analysis">Start an analysis</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="capitalize">{item.kind}</span>
                {item.timestamp && (
                  <>
                    {" · "}
                    <time dateTime={item.timestamp} className="metric-figure">
                      {formatTimestamp(item.timestamp)}
                    </time>
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {item.risk && (
                <StatusBadge tone={riskTone(item.risk)} className="hidden sm:inline-flex">
                  {item.risk} risk
                </StatusBadge>
              )}
              <StatusBadge tone={processTone(item.status)} dot>
                {item.status}
              </StatusBadge>
              <IconChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Fixed-width, locale-stable format so the row height never changes. */
function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(iso))
}

export function RecentActivitySkeleton() {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-48 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-20 shrink-0 animate-pulse rounded-md bg-muted" />
        </li>
      ))}
    </ul>
  )
}
