"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock, Mail, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CodeField,
  FormAlert,
  PasswordField,
  TextField,
} from "@/features/auth/components/auth-fields";
import {
  useResendEmailCodeMutation,
  useSignupMutation,
  useVerifyEmailMutation,
  type SignupVerification,
} from "@/features/auth/hooks/use-auth-mutations";
import {
  signupSchema,
  verifyEmailSchema,
  type SignupValues,
  type VerifyEmailValues,
} from "@/features/auth/schemas/auth.schemas";
import { applyAuthError } from "@/features/auth/utils/auth-error-map";
import { authHref } from "@/features/auth/utils/auth-route";

interface SignupFormProps {
  redirectUrl: string;
  onSignedIn: () => void;
}

/**
 * Two steps: account details, then email verification. The step is local state
 * rather than a route mode because Clerk holds the pending sign-up attempt in
 * memory — a reload loses it either way, so the URL would lie.
 */
export function SignupForm({ redirectUrl, onSignedIn }: SignupFormProps) {
  const [step, setStep] = useState<SignupVerification>("none");

  const signup = useSignupMutation();
  const verify = useVerifyEmailMutation();
  const resend = useResendEmailCodeMutation();

  const detailsForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const codeForm = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    mode: "onChange",
    defaultValues: { code: "" },
  });

  const onDetailsSubmit = detailsForm.handleSubmit(async (values) => {
    if (signup.isPending) return;
    detailsForm.clearErrors("root");
    try {
      const { verification } = await signup.mutateAsync(values);
      if (verification === "none") {
        onSignedIn();
        return;
      }
      setStep(verification);
      toast.success(
        verification === "code"
          ? "Check your email for the 6-digit verification code."
          : "Check your email for the verification link."
      );
    } catch (error) {
      applyAuthError(error, "signup", detailsForm.setError, onSignedIn);
    }
  });

  const onCodeSubmit = codeForm.handleSubmit(async (values) => {
    if (verify.isPending) return;
    codeForm.clearErrors("root");
    try {
      await verify.mutateAsync(values);
      onSignedIn();
    } catch (error) {
      applyAuthError(error, "verify", codeForm.setError, onSignedIn);
    }
  });

  const onResend = async () => {
    try {
      await resend.mutateAsync();
      codeForm.reset({ code: "" });
      toast.success("A new code is on its way.");
    } catch {
      toast.error("Could not send a new code. Please try again.");
    }
  };

  if (step === "link") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          Your account is created. Open the verification link we emailed you, then sign in.
        </p>
        <Button asChild className="h-12 w-full text-lg">
          <Link href={authHref("login", redirectUrl)}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={onCodeSubmit} className="space-y-4" noValidate>
        <CodeField
          id="signupCode"
          label="Verification code"
          autoFocus
          disabled={verify.isPending}
          error={codeForm.formState.errors.code?.message}
          register={codeForm.register("code")}
        />

        <FormAlert message={codeForm.formState.errors.root?.message} />

        <Button
          type="submit"
          className="h-12 w-full text-lg"
          disabled={verify.isPending || !codeForm.formState.isValid || !verify.isReady}
        >
          {verify.isPending ? "Verifying..." : "Verify email"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={resend.isPending || !resend.isReady}
          onClick={onResend}
        >
          {resend.isPending ? "Sending..." : "Send a new code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onDetailsSubmit} className="space-y-4" noValidate>
      <TextField
        id="name"
        label="Full name"
        icon={User}
        placeholder="Jane Doe"
        autoComplete="name"
        disabled={signup.isPending}
        error={detailsForm.formState.errors.name?.message}
        register={detailsForm.register("name")}
      />

      <TextField
        id="signupEmail"
        type="email"
        label="Email"
        icon={Mail}
        placeholder="doctor@hospital.com"
        autoComplete="email"
        disabled={signup.isPending}
        error={detailsForm.formState.errors.email?.message}
        register={detailsForm.register("email")}
      />

      <PasswordField
        id="signupPassword"
        label="Password"
        icon={Lock}
        placeholder="Create a strong password (8+ characters)"
        autoComplete="new-password"
        disabled={signup.isPending}
        error={detailsForm.formState.errors.password?.message}
        register={detailsForm.register("password")}
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm password"
        icon={Lock}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        disabled={signup.isPending}
        error={detailsForm.formState.errors.confirmPassword?.message}
        register={detailsForm.register("confirmPassword")}
      />

      <FormAlert message={detailsForm.formState.errors.root?.message} />

      <Button
        type="submit"
        className="h-12 w-full text-lg"
        disabled={signup.isPending || !detailsForm.formState.isValid || !signup.isReady}
      >
        {signup.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
