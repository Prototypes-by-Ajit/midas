import Link from "next/link"
import { IconBrain } from "@tabler/icons-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ShellDisclaimer } from "@/components/clinical/medical-disclaimer"

/**
 * Compact shell header. Server Component.
 *
 * It deliberately does NOT render a page title — each page owns its own `<h1>`
 * via `PageHeader`, so a title here would give every route two `<h1>`s. On
 * mobile the sidebar collapses into a sheet, so the wordmark appears here to
 * keep product identity visible once the rail is gone.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
        >
          <IconBrain className="size-5 text-primary" aria-hidden />
          <span className="text-base">MIDAS</span>
        </Link>

        <ShellDisclaimer className="ml-auto hidden md:block" />
      </div>
    </header>
  )
}
