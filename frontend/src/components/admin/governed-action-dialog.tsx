"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * T057 -- FR-USR-5 (both halves: role change and offboard). Externally
 * controlled (`open`/`onOpenChange`) rather than owning its own trigger,
 * unlike `InviteDialog` -- this one opens from a row action in
 * `users-console.tsx`, which needs to know *which* row and *which* action
 * before the dialog can render anything. Same forms-design.md pattern
 * (Zod/RHF/TanStack) and the same duplicate-submission treatment as T056.
 */
export type GovernedAction =
  | { mode: "role_change"; userId: string; userName: string; newRole: string }
  | { mode: "offboard"; userId: string; userName: string }
  | { mode: "delete"; userId: string; userName: string }

const reasonSchema = z.object({
  reason: z.string().trim().min(1, "State the reason for this action."),
})

type ReasonInput = z.infer<typeof reasonSchema>

export function GovernedActionDialog({
  action,
  onOpenChange,
}: {
  action: GovernedAction | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const form = useForm<ReasonInput>({
    resolver: zodResolver(reasonSchema),
    mode: "onChange",
    defaultValues: { reason: "" },
  })

  const mutation = useMutation({
    mutationFn: async (input: ReasonInput) => {
      if (!action) throw new Error("No action selected.")
      const url =
        action.mode === "role_change"
          ? `/api/admin/users/${action.userId}/role`
          : action.mode === "offboard"
            ? `/api/admin/users/${action.userId}/offboard`
            : `/api/admin/users/${action.userId}/delete`
      const body = action.mode === "role_change" ? { role: action.newRole, reason: input.reason } : { reason: input.reason }

      const response = await fetch(url, {
        method: action.mode === "role_change" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as { error_code?: string } | null
      if (!response.ok) {
        throw new Error(mapErrorCode(payload?.error_code))
      }
      return payload
    },
    onSuccess: () => {
      form.reset({ reason: "" })
      router.refresh()
    },
  })

  const submitting = mutation.isPending
  const onSubmit = form.handleSubmit((values) => {
    if (submitting) return
    mutation.mutate(values)
  })

  const close = () => {
    onOpenChange(false)
    // Reset after the close animation reads the old state once; a stale
    // success/error message flashing on the next open is worse than a
    // one-frame-late reset.
    setTimeout(() => {
      form.reset({ reason: "" })
      mutation.reset()
    }, 150)
  }

  return (
    <Dialog open={action !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action?.mode === "offboard" ? "Offboard user" : action?.mode === "delete" ? "Delete user" : "Change role"}
          </DialogTitle>
          <DialogDescription>
            {action?.mode === "offboard"
              ? `Revokes every active session for ${action.userName} immediately and removes their access. This cannot be undone.`
              : action?.mode === "delete"
                ? `Permanently deletes ${action.userName}'s account. Unlike offboarding, this cannot be reversed and the account cannot be recovered.`
                : action
                  ? `Changes ${action.userName}'s role to ${action.newRole}. Takes effect at their next sign-in.`
                  : ""}
          </DialogDescription>
        </DialogHeader>

        {mutation.isSuccess ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-sm text-success">Done.</p>
            <DialogFooter>
              <Button className="min-h-11" onClick={close}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <fieldset disabled={submitting} className="flex flex-col gap-1.5">
              <Label htmlFor="governed-reason">Reason</Label>
              <Textarea
                id="governed-reason"
                rows={3}
                aria-invalid={Boolean(form.formState.errors.reason)}
                {...form.register("reason")}
              />
              {form.formState.errors.reason && (
                <p role="alert" className="text-sm text-critical">{form.formState.errors.reason.message}</p>
              )}
            </fieldset>

            {mutation.isError && (
              <p role="alert" className="rounded-lg border border-critical/30 bg-critical-subtle px-4 py-3 text-sm text-critical">
                {mutation.error instanceof Error ? mutation.error.message : "That action could not be completed. Try again."}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={action?.mode === "offboard" || action?.mode === "delete" ? "destructive" : "default"}
                className="min-h-11"
                disabled={submitting || !form.formState.isValid}
              >
                {submitting
                  ? "Working…"
                  : action?.mode === "offboard"
                    ? "Offboard"
                    : action?.mode === "delete"
                      ? "Delete user"
                      : "Change role"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function mapErrorCode(code: string | undefined): string {
  switch (code) {
    case "EMPTY_REASON":
      return "A reason is required."
    case "FORBIDDEN":
      return "You don't have permission to do this."
    case "LAST_ADMIN_GUARD":
      return "This would leave zero Admins. Assign another Admin first."
    case "RPC_FAILED_COMPENSATED":
    case "DOMAIN_CALL_FAILED":
      return "The change could not be completed and was rolled back. Try again."
    default:
      return "That action could not be completed. Try again."
  }
}
