"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { SIGN_DIALOG_COPY } from "@/data/clinical/sign-copy"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * The signature confirmation. Its own component, not a detail of another —
 * signing is the one action in this slice that cannot be undone, and the
 * confirmation is the only thing standing between a mis-click and a permanent
 * attribution.
 *
 * BUILT ON `components/ui/dialog.tsx`, WHICH WRAPS `@radix-ui/react-dialog`.
 * `@radix-ui/react-alert-dialog` is not installed and must not be added (G2) —
 * an alert dialog is a Radix *Dialog* with `role="alertdialog"`, outside-click
 * dismissal prevented, and the description wired to `aria-describedby`. All three
 * are props on the component that already exists; a second Radix package would
 * ship a second focus-trap implementation to get a different default.
 *
 * What Radix gives us and we do not reimplement: focus is trapped inside the
 * dialog while open, and returns to the trigger on close. Both are defaults of
 * `Dialog.Content`.
 *
 * What we change from the default:
 *   role="alertdialog"      — a screen reader announces title *and* description
 *                             immediately, rather than only on focus
 *   onInteractOutside       — prevented. A stray click on the overlay must not
 *                             dismiss a decision this size (G2)
 *   Escape                  — left alone, so it still cancels. Trapping a person
 *                             in a modal to make them read it is a worse pattern
 *                             than the one it replaces
 *   showCloseButton={false} — the only three exits are Cancel, Escape, and Sign,
 *                             so every exit is a choice the person made
 */

interface SignDialogProps {
  versionId: string
  versionNumber: number
  /** Disables the trigger when the version is already signed or not yet ready. */
  disabled?: boolean
}

export function SignDialog({ versionId, versionNumber, disabled = false }: SignDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/clinical/versions/${versionId}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error ?? SIGN_DIALOG_COPY.failed)
      return payload
    },
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-request would leave the person with no idea whether their
        // name is now on the document.
        if (mutation.isPending) return
        setOpen(next)
        if (!next) mutation.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11" disabled={disabled}>
          {SIGN_DIALOG_COPY.trigger}
          <span className="sr-only"> — version {versionNumber}</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        // G2: a click on the overlay must not dismiss this. Escape is deliberately
        // left to its default, so cancelling by keyboard still works.
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{SIGN_DIALOG_COPY.title}</DialogTitle>
          {/*
            `DialogDescription` renders the element Radix points `aria-describedby`
            at, so a screen reader hears the irreversibility sentence as part of
            the dialog's description rather than as body text it may skip.

            Rendered unconditionally, in the same subtree as the confirm button and
            before it in DOM order — the confirm button is never reachable at a
            moment when this sentence is not on screen.

            No colour carries the warning. The sentence does. Emphasis is weight,
            which survives a stylesheet being off and a monochrome display.
          */}
          <DialogDescription>
            Signing attaches your name to this version permanently.{" "}
            <strong className="font-semibold text-foreground">
              {SIGN_DIALOG_COPY.irreversible}
            </strong>{" "}
            If a correction is needed later, you&apos;ll sign a new version instead.
          </DialogDescription>
        </DialogHeader>

        {mutation.isError && (
          <p
            role="alert"
            className="rounded-lg border border-critical/30 bg-critical-subtle px-4 py-3 text-sm text-critical"
          >
            {mutation.error instanceof Error ? mutation.error.message : SIGN_DIALOG_COPY.failed}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="min-h-11" disabled={mutation.isPending}>
              {SIGN_DIALOG_COPY.cancel}
            </Button>
          </DialogClose>
          <Button
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? SIGN_DIALOG_COPY.pending : SIGN_DIALOG_COPY.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
