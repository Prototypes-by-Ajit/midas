import Link from "next/link"
import { IconChevronRight } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  /** Omit on the final crumb — it renders as the current page. */
  href?: string
}

/**
 * Breadcrumb + title + optional primary action. Server Component, so the page
 * title and trail are in the initial HTML.
 *
 * `action` is a slot: pass a server-rendered `<Link>` for navigation, or a
 * client island when the action needs a handler. The header itself stays server.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  action,
  className,
}: {
  title: string
  description?: string
  crumbs?: Crumb[]
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

/**
 * Heading for a panel inside a page. Sits *above* the panel's card, never
 * inside it — that is the one treatment, so three panels in the same grid read
 * as siblings. `action` is the optional trailing slot ("View all").
 *
 * Pair `id` with `aria-labelledby` on the owning `<section>`.
 *
 * Server Component.
 */
export function SectionHeading({
  id,
  title,
  action,
  className,
}: {
  id?: string
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("mb-3 flex min-h-6 items-center justify-between gap-3", className)}
    >
      <h2 id={id} className="text-sm font-medium text-foreground">
        {title}
      </h2>
      {action}
    </div>
  )
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={crumb.label} className="flex items-center gap-1">
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="text-foreground">
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <IconChevronRight className="size-3 shrink-0" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
