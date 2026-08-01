"use client";

import { useCallback } from "react";
import { motion } from "motion/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoading } from "@/contexts/loading-context";
import { LoginForm } from "@/features/auth/components/login-form";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { SignupForm } from "@/features/auth/components/signup-form";
import type { AuthMode } from "@/features/auth/utils/auth-route";

/**
 * The auth form package. The route owns which mode is active and where a
 * signed-in user goes; this component owns schema selection, field rendering,
 * mutation state and error display for that mode.
 */
export interface AuthFormProps {
  mode: AuthMode;
  /** Already validated as a same-origin path by the route. */
  redirectUrl: string;
}

const COPY: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: "Welcome Back",
    description: "Sign in to access your MIDAS dashboard",
  },
  signup: {
    title: "Join MIDAS",
    description: "Create your account to access the future of dermatology",
  },
  resetpassword: {
    title: "Reset Password",
    description: "We'll email you a 6-digit code to set a new password",
  },
};

export function AuthForm({ mode, redirectUrl }: AuthFormProps) {
  const { setLoadingState } = useLoading();

  /**
   * A full document load rather than router.push: the Clerk session cookie is
   * only guaranteed to be seen by `middleware.ts` on a fresh request, and the
   * dashboard is gated there.
   */
  const onSignedIn = useCallback(() => {
    setLoadingState(true, "Accessing Dashboard...");
    window.location.assign(redirectUrl);
  }, [redirectUrl, setLoadingState]);

  const copy = COPY[mode];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="border shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="mb-2 text-3xl font-bold">{copy.title}</CardTitle>
          <p className="text-lg text-muted-foreground">{copy.description}</p>
        </CardHeader>

        <CardContent>
          {mode === "login" && <LoginForm redirectUrl={redirectUrl} onSignedIn={onSignedIn} />}
          {mode === "signup" && <SignupForm redirectUrl={redirectUrl} onSignedIn={onSignedIn} />}
          {mode === "resetpassword" && (
            <ResetPasswordForm redirectUrl={redirectUrl} onSignedIn={onSignedIn} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
