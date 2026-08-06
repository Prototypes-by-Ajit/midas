import type { TablerIcon } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

/**
 * Compact metric. Tabular numerals keep the figure from reflowing as it
 * changes, and the tile has a fixed min-height so the skeleton can match it
 * exactly and the grid does not shift when data arrives.
 *
 * Server Component.
 */
export function MetricTile({
  label,
  value,
  icon: Icon,
  note,
  className,
}: {
  label: string
  /** Pre-formatted. Pass "—" for "no data yet" rather than a misleading 0. */
  value: string | number
  icon?: TablerIcon
  note?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col justify-between rounded-xl border bg-card p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          // Chip, not a bare glyph: gives the tile a consistent anchor and keeps
          // the 28px row height stable whether or not an icon is passed.
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="metric-figure text-3xl font-semibold leading-none text-foreground">
          {value}
        </div>
        {note && (
          <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
        )}
      </div>
    </div>
  )
}

/** Dimension-matched placeholder — same min-height, same internal rhythm. */
export function MetricTileSkeleton() {
  return (
    <div className="flex min-h-[120px] flex-col justify-between rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="size-7 shrink-0 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-2">
        <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
