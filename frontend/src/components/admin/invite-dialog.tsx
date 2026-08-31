"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * T056 -- FR-USR-3. Follows `.claude/rules/forms-design.md` exactly (same
 * pattern as `components/clinical/decision-form.tsx`): Zod validates, React
 * Hook Form owns field state, TanStack Query owns submit state. The route
 * (`/api/admin/users/invite`, T038) re-validates everything below server-
 * side and is the actual enforcement -- this schema only improves UX.
 */
const inviteSchema = z.object({
  email: z.string().trim().min(1, "Enter an email address.").email("Enter a valid email address."),
  role: z.enum(["admin", "clinician", "patient"]),
  site: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(1, "Say why you're inviting this person."),
})

type InviteInput = z.infer<typeof inviteSchema>

const ROLE_OPTIONS: Array<{ value: InviteInput["role"]; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "clinician", label: "Clinician" },
  { value: "patient", label: "Patient" },
]

export function InviteDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    mode: "onChange",
    defaultValues: { email: "", role: "patient", site: "", reason: "" },
  })

  const mutation = useMutation({
    mutationFn: async (input: InviteInput) => {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
      const payload = (await response.json().catch(() => null)) as
        | { outcome?: string; evt_id?: string; error_code?: string }
        | null
      if (!response.ok) {
        throw new Error(mapErrorCode(payload?.error_code))
      }
      return payload
    },
    onSuccess: () => {
      // "duplicate" renders as an identical success to a first-time "allowed"
      // (design review Pass 2 finding) -- a resubmit cannot be told apart
      // from a first attempt, so this branch never checks `outcome`.
      form.reset({ email: "", role: "patient", site: "", reason: "" })
      router.refresh()
    },
  })

  const submitting = mutation.isPending
  const onSubmit = form.handleSubmit((values) => {
    if (submitting) return
    mutation.mutate(values)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) mutation.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11">Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            Expires in 7 days. The role captured here is the role in effect from their first sign-in, which
            requires multi-factor enrollment.
          </DialogDescription>
        </DialogHeader>

        {mutation.isSuccess ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-sm text-success">
              Invitation sent.
            </p>
            <DialogFooter>
              <Button className="min-h-11" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <fieldset className="flex flex-col gap-4" disabled={submitting}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  className="min-h-11"
                  aria-invalid={Boolean(form.formState.errors.email)}
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p role="alert" className="text-sm text-critical">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className="border-input bg-background flex min-h-11 rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  {...form.register("role")}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-site">Site / org (optional)</Label>
                <Input id="invite-site" className="min-h-11" {...form.register("site")} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-reason">Reason</Label>
                <Textarea
                  id="invite-reason"
                  rows={3}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  {...form.register("reason")}
                />
                {form.formState.errors.reason && (
                  <p role="alert" className="text-sm text-critical">{form.formState.errors.reason.message}</p>
                )}
              </div>
            </fieldset>

            {mutation.isError && (
              <p role="alert" className="rounded-lg border border-critical/30 bg-critical-subtle px-4 py-3 text-sm text-critical">
                {mutation.error instanceof Error ? mutation.error.message : "That invitation could not be sent. Try again."}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={submitting || !form.formState.isValid}>
                {submitting ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Raw backend error codes mapped to safe, actionable UI copy (forms-design §12). */
function mapErrorCode(code: string | undefined): string {
  switch (code) {
    case "EMPTY_REASON":
      return "A reason is required."
    case "FORBIDDEN":
      return "You don't have permission to invite users."
    case "RPC_FAILED_COMPENSATED":
    case "DOMAIN_CALL_FAILED":
      return "The invitation could not be completed. No invitation was sent -- try again."
    default:
      return "That invitation could not be sent. Try again."
  }
}
