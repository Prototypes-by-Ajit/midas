import { IconInfoCircle } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

/**
 * MIDAS is a decision-support tool, not a diagnostic device. That claim is
 * stated in exactly one place so the wording cannot drift between surfaces.
 *
 * All Server Components.
 */
export const NOT_A_DIAGNOSIS =
  "MIDAS produces a statistical assessment, not a diagnosis. Model output must be interpreted by a qualified clinician alongside examination and history, and should never be used on its own to rule a condition in or out."

export const SHELL_DISCLAIMER =
  "Clinical decision support. Not a diagnostic device."

/**
 * Prominent notice for surfaces that display model output. Deliberately plain
 * text on a quiet surface — this must read as a standing condition of use, not
 * as an error the user can dismiss.
 */
export function NotADiagnosisNotice({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Clinical limitations"
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-surface px-4 py-3",
        className
      )}
    >
      <IconInfoCircle
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Not a diagnosis. </span>
        {NOT_A_DIAGNOSIS}
      </p>
    </aside>
  )
}

/**
 * The persistent, quiet version for the app shell. Low contrast by intent: it
 * must be permanently available without competing with the task on screen.
 */
export function ShellDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("px-2 text-[11px] leading-snug text-muted-foreground", className)}>
      {SHELL_DISCLAIMER}{" "}
      <a
        href="/dashboard/help#limitations"
        className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Limitations
      </a>
    </p>
  )
}
