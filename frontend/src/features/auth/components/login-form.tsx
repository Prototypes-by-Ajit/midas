"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FcGoogle } from "react-icons/fc";
import { Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormAlert, PasswordField, TextField } from "@/features/auth/components/auth-fields";
import { useGoogleAuthMutation, useLoginMutation } from "@/features/auth/hooks/use-auth-mutations";
import { loginSchema, type LoginValues } from "@/features/auth/schemas/auth.schemas";
import { applyAuthError } from "@/features/auth/utils/auth-error-map";
import { authHref } from "@/features/auth/utils/auth-route";

interface LoginFormProps {
  redirectUrl: string;
  onSignedIn: () => void;
}

export function LoginForm({ redirectUrl, onSignedIn }: LoginFormProps) {
  const login = useLoginMutation();
  const google = useGoogleAuthMutation(redirectUrl);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isValid },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const busy = login.isPending || google.isPending;

  const onSubmit = handleSubmit(async (values) => {
    if (busy) return;
    clearErrors("root");
    try {
      await login.mutateAsync(values);
      onSignedIn();
    } catch (error) {
      applyAuthError(error, "login", setError, onSignedIn);
    }
  });

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-lg"
        disabled={busy || !google.isReady}
        onClick={() => google.mutate()}
      >
        <FcGoogle className="mr-3 h-6 w-6" />
        {google.isPending ? "Redirecting to Google..." : "Continue with Google"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-3 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField
          id="email"
          type="email"
          label="Email"
          icon={Mail}
          placeholder="doctor@hospital.com"
          autoComplete="email"
          disabled={busy}
          error={errors.email?.message}
          register={register("email")}
        />

        <PasswordField
          id="password"
          label="Password"
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={busy}
          error={errors.password?.message}
          register={register("password")}
          action={
            <Link
              href={authHref("resetpassword", redirectUrl)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-500"
            >
              Forgot password?
            </Link>
          }
        />

        <FormAlert message={errors.root?.message} />

        <Button
          type="submit"
          className="h-12 w-full text-lg"
          disabled={busy || !isValid || !login.isReady}
        >
          {login.isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
