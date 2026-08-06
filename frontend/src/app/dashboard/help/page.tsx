import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IconExternalLink, IconHelp, IconQuestionMark } from "@tabler/icons-react"
import { FAQS, HELP_RESOURCES, QUICK_HELP, SUPPORT_CHANNELS } from "@/data/dashboard/help"
import { FaqSearch } from "@/comps/dashboard/help/faq-search"
import {
  ServiceStatusPanel,
  ServiceStatusSkeleton,
} from "@/comps/dashboard/overview/service-status-panel"
import { getSessionUser } from "@/services/auth.server"
import type { HelpAction } from "@/types/dashboard"

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Find answers, guides, and get support for your MIDAS AI platform.",
}

/** Shared row for the support and resources rails. Always a real link. */
function ActionRow({ icon: Icon, label, description, href, external }: HelpAction) {
  const content = (
    <>
      <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {external && <IconExternalLink className="h-3 w-3 shrink-0" aria-hidden />}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </>
  )

  const className =
    "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

/**
 * Server Component. The only client code on this route is the FAQ search box.
 *
 * Layout is a help-centre two-column: questions get the wide column because
 * they are what people came for, and the narrow rail carries live service
 * status plus the ways out of the page. Service status used to sit at the very
 * bottom under a wall of FAQ text, which is the wrong place for the one live
 * signal here.
 */
export default async function HelpPage() {
  const session = await getSessionUser()

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <IconHelp className="h-6 w-6 shrink-0 sm:h-8 sm:w-8" aria-hidden />
          Help &amp; Support
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Answers about how MIDAS works, what its results mean, and where its limits are.
        </p>
      </header>

      {/* Shortcuts to the actual features, not to docs pages that don't exist. */}
      <nav aria-label="Quick actions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_HELP.map(({ icon: Icon, title, description, href }) => (
          <Link
            key={title}
            href={href}
            className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <span className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {description}
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconQuestionMark className="h-5 w-5 shrink-0" aria-hidden />
              Frequently asked questions
            </CardTitle>
            <CardDescription>
              Search across every question and answer on this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaqSearch faqs={FAQS} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* The one live signal on this page — real probes, "unknown" when a
              dependency cannot be reached, never hardcoded to look healthy. */}
          {session && (
            <Suspense fallback={<ServiceStatusSkeleton />}>
              <ServiceStatusPanel userId={session.userId} />
            </Suspense>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Still stuck?</CardTitle>
              <CardDescription>Reach a human if the answer is not here.</CardDescription>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {SUPPORT_CHANNELS.map((action) => (
                <ActionRow key={action.label} {...action} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resources</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {HELP_RESOURCES.map((action) => (
                <ActionRow key={action.label} {...action} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
