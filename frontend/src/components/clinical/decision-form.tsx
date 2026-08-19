"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { REVIEW_OUTCOMES } from "@/lib/clinical/contract"

/**
 * The one `"use client"` island in the clinician case view.
 *
 * Everything around it stays a Server Component: the evidence, the model output,
 * the decision history. Only the act of recording a decision needs a handler, so
 * only that is a client component (`.claude/rules/nextjs-frontend-rules.md`).
 *
 * Follows `.claude/rules/forms-design.md` exactly:
 *   Zod            — validation truth, and the form's TypeScript type is inferred
 *                    from it rather than declared beside it
 *   React Hook Form — local field state
 *   TanStack Query  — async submit state; no `useState` loading flag
 *   The backend     — business truth. This form decides nothing.
 *
 * THE SCHEMA IS THE SAME SHAPE THE ROUTE VALIDATES, NOT A LOOSER ONE. The
 * handler re-validates with its own copy; if these drift, the difference shows up
 * as a 422 the user cannot act on. The bound is kept identical on purpose.
 */

/** Matches `MAX_NOTE_LENGTH` in `app/api/clinical/cases/[id]/review/route.ts`. */
const MAX_NOTE_LENGTH = 4000

const decisionSchema = z.object({
  outcome: z.enum(REVIEW_OUTCOMES),
  note: z
    .string()
    .trim()
    .min(1, "Write what you decided, or what you need from the patient.")
    .max(MAX_NOTE_LENGTH, `Keep this under ${MAX_NOTE_LENGTH.toLocaleString()} characters.`),
})

/** Inferred from the schema — never declared separately (forms-design §4.2). */
type DecisionInput = z.infer<typeof decisionSchema>

interface DecisionFormProps {
  caseId: string
}

export function DecisionForm({ caseId }: DecisionFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<DecisionInput>({
    resolver: zodResolver(decisionSchema),
    mode: "onChange",
    defaultValues: { outcome: "decision_recorded", note: "" },
  })

  /**
   * TanStack Query owns the async state, so `isPending` is the single source of
   * truth for the disabled button — a `useState` flag can desynchronise from the
   * request, and the way it desynchronises is a second submit landing.
   */
  const mutation = useMutation({
    mutationFn: async (input: DecisionInput) => {
      const response = await fetch(`/api/clinical/cases/${caseId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        // The backend's message is mapped, not shown raw (forms-design §12).
        throw new Error(payload?.error ?? "That decision could not be recorded. Try again.")
      }
      return payload
    },
    onSuccess: () => {
      form.reset({ outcome: "decision_recorded", note: "" })
      queryClient.invalidateQueries({ queryKey: ["clinical", "case", caseId] })
      // The page is a Server Component, so the new state comes from a re-render
      // on the server rather than from client cache — this is what makes the
      // decision history and the state badge agree after a submit.
      router.refresh()
    },
  })

  const outcome = form.watch("outcome")
  const isRequestingData = outcome === "more_data_requested"

  /**
   * Double-submit is prevented in two independent places, because one is not
   * enough: `disabled` stops the pointer, and the `isPending` guard stops a
   * keyboard Enter that fires while the button is mid-disable. The route's
   * `plpgsql` function is the third — it refuses a second decision from a case
   * that has already left `claimed`.
   */
  const submitting = mutation.isPending
  const onSubmit = form.handleSubmit((values) => {
    if (submitting) return
    mutation.mutate(values)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2" disabled={submitting}>
        <legend className="mb-2 text-sm font-medium text-foreground">
          What are you recording?
        </legend>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
          <input
            type="radio"
            value="decision_recorded"
            {...form.register("outcome")}
            className="size-4 accent-primary"
          />
          <span className="text-sm text-foreground">
            A decision
            <span className="block text-xs text-muted-foreground">
              Creates version 1 of the report for you to sign.
            </span>
          </span>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
          <input
            type="radio"
            value="more_data_requested"
            {...form.register("outcome")}
            className="size-4 accent-primary"
          />
          <span className="text-sm text-foreground">
            A request for more information
            <span className="block text-xs text-muted-foreground">
              The case stays on your list while the patient responds.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="decision-note">
          {isRequestingData ? "What do you need from the patient?" : "Your decision"}
        </Label>
        {/*
          This text reaches the patient verbatim when the outcome is a request for
          more information (FR-006). The hint says so, because a clinician writing
          a note for a colleague and a clinician writing to a patient write
          differently, and only one of them knows which this is.
        */}
        <p id="decision-note-hint" className="text-xs text-muted-foreground">
          {isRequestingData
            ? "The patient reads this exactly as you write it."
            : "Recorded against this case permanently, and attributed to you."}
        </p>
        <Textarea
          id="decision-note"
          rows={6}
          disabled={submitting}
          aria-describedby="decision-note-hint"
          aria-invalid={Boolean(form.formState.errors.note)}
          {...form.register("note")}
        />
        {form.formState.errors.note && (
          <p role="alert" className="text-sm text-critical">
            {form.formState.errors.note.message}
          </p>
        )}
      </div>

      {mutation.isError && (
        <p role="alert" className="rounded-lg border border-critical/30 bg-critical-subtle px-4 py-3 text-sm text-critical">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "That decision could not be recorded. Try again."}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          className="min-h-11"
          disabled={submitting || !form.formState.isValid}
        >
          {submitting
            ? "Recording…"
            : isRequestingData
              ? "Request information"
              : "Record decision"}
        </Button>
        {mutation.isSuccess && !submitting && (
          <p role="status" className="text-sm text-success">
            Recorded.
          </p>
        )}
      </div>
    </form>
  )
}
