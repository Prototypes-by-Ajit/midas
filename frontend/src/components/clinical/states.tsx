import Link from "next/link"
import {
  IconAlertTriangle,
  IconLock,
  IconPlugConnectedX,
  type TablerIcon,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The explicit non-happy-path states the spec requires. All Server Components —
 * none of them hold state, and a page must be able to render them without
 * shipping JS. Any action is passed in as a slot.
 *
 * They share one frame so an empty list, a failed fetch and a denied page all
 * occupy the same space and swapping between them causes no layout shift.
 */
function StateFrame({
  icon: Icon,
  iconClass,
  title,
  body,
  action,
  className,
}: {
  icon: TablerIcon
  iconClass?: string
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-10 text-center",
        className
      )}
    >
      <Icon className={cn("size-6 text-muted-foreground", iconClass)} aria-hidden />
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}

/** Nothing here yet — a normal, non-alarming outcome. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: TablerIcon
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <StateFrame
      icon={icon}
      title={title}
      body={body}
      action={action}
      className={className}
    />
  )
}

/** Something failed. Never blames the user; always offers a way forward. */
export function ErrorState({
  title = "Could not load this data",
  body = "The request did not complete. This is usually temporary — try again in a moment.",
  action,
  className,
}: {
  title?: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <StateFrame
      icon={IconAlertTriangle}
      iconClass="text-critical"
      title={title}
      body={body}
      action={action}
      className={cn("border-critical/30", className)}
    />
  )
}

/**
 * Authorized-but-not-permitted. Deliberately states the required role without
 * hinting at how to obtain it, and is never the only thing standing between a
 * user and the data — the API re-checks server-side.
 */
export function PermissionDenied({
  requiredRole,
  className,
}: {
  requiredRole: string
  className?: string
}) {
  return (
    <StateFrame
      icon={IconLock}
      title="You do not have access to this page"
      body={`This area is limited to ${requiredRole} accounts. If you believe this is a mistake, contact your administrator.`}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
      className={className}
    />
  )
}

/**
 * A dependency is down but the page still works. Used where the product
 * degrades rather than fails — e.g. the assistant answering without retrieval.
 */
export function DegradedNotice({
  title = "Running in reduced capability",
  body,
  className,
}: {
  title?: string
  body: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3",
        className
      )}
    >
      <IconPlugConnectedX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-0.5 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
