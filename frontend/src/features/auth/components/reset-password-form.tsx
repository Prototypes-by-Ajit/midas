"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CodeField,
  FormAlert,
  PasswordField,
  TextField,
} from "@/features/auth/components/auth-fields";
import {
  useResetPasswordMutation,
  useResetRequestMutation,
} from "@/features/auth/hooks/use-auth-mutations";
import {
  resetPasswordSchema,
  resetRequestSchema,
  type ResetPasswordValues,
  type ResetRequestValues,
} from "@/features/auth/schemas/auth.schemas";
import { applyAuthError } from "@/features/auth/utils/auth-error-map";
import { authHref } from "@/features/auth/utils/auth-route";

interface ResetPasswordFormProps {
  redirectUrl: string;
  onSignedIn: () => void;
}

/** Deliberately says nothing about whether the address has an account. */
const SENT_MESSAGE =
  "If an account exists for that email, a 6-digit code is on its way.";

export function ResetPasswordForm({ redirectUrl, onSignedIn }: ResetPasswordFormProps) {
  const [awaitingCode, setAwaitingCode] = useState(false);

  const request = useResetRequestMutation();
  const reset = useResetPasswordMutation();

  const requestForm = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: { code: "", password: "" },
  });

  const onRequestSubmit = requestForm.handleSubmit(async (values) => {
    if (request.isPending) return;
    requestForm.clearErrors("root");
    try {
      await request.mutateAsync(values);
      setAwaitingCode(true);
      toast.success(SENT_MESSAGE);
    } catch (error) {
      applyAuthError(error, "reset", requestForm.setError, onSignedIn);
    }
  });

  const onResetSubmit = resetForm.handleSubmit(async (values) => {
    if (reset.isPending) return;
    resetForm.clearErrors("root");
    try {
      await reset.mutateAsync(values);
      onSignedIn();
    } catch (error) {
      applyAuthError(error, "reset", resetForm.setError, onSignedIn);
    }
  });

  const backToSignIn = (
    <Button asChild type="button" variant="ghost" className="w-full">
      <Link href={authHref("login", redirectUrl)}>Back to sign in</Link>
    </Button>
  );

  if (!awaitingCode) {
    return (
      <form onSubmit={onRequestSubmit} className="space-y-4" noValidate>
        <TextField
          id="resetEmail"
          type="email"
          label="Email"
          icon={Mail}
          placeholder="doctor@hospital.com"
          autoComplete="email"
          autoFocus
          disabled={request.isPending}
          error={requestForm.formState.errors.email?.message}
          register={requestForm.register("email")}
        />

        <FormAlert message={requestForm.formState.errors.root?.message} />

        <Button
          type="submit"
          className="h-12 w-full text-lg"
          disabled={request.isPending || !requestForm.formState.isValid || !request.isReady}
        >
          {request.isPending ? "Sending code..." : "Send reset code"}
        </Button>

        {backToSignIn}
      </form>
    );
  }

  return (
    <form onSubmit={onResetSubmit} className="space-y-4" noValidate>
      <CodeField
        id="resetCode"
        label="Verification code"
        autoFocus
        disabled={reset.isPending}
        error={resetForm.formState.errors.code?.message}
        register={resetForm.register("code")}
      />

      <PasswordField
        id="newPassword"
        label="New password"
        icon={Lock}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        disabled={reset.isPending}
        error={resetForm.formState.errors.password?.message}
        register={resetForm.register("password")}
      />

      <FormAlert message={resetForm.formState.errors.root?.message} />

      <Button
        type="submit"
        className="h-12 w-full text-lg"
        disabled={reset.isPending || !resetForm.formState.isValid || !reset.isReady}
      >
        {reset.isPending ? "Resetting password..." : "Reset password"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={reset.isPending}
        onClick={() => {
          resetForm.reset({ code: "", password: "" });
          setAwaitingCode(false);
        }}
      >
        Use a different email
      </Button>
    </form>
  );
}
