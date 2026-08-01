"use client";

import { useMutation } from "@tanstack/react-query";
import { useSignIn, useSignUp } from "@clerk/nextjs";

import type {
  LoginValues,
  ResetPasswordValues,
  ResetRequestValues,
  SignupValues,
  VerifyEmailValues,
} from "@/features/auth/schemas/auth.schemas";
import { AuthFlowError } from "@/features/auth/utils/auth-error-map";

/**
 * TanStack Query owns async submit state for every auth action; Clerk owns the
 * business truth. Nothing here writes cookies or sessions by hand — `setActive`
 * is Clerk's own session handover.
 *
 * Each hook returns the mutation plus `isReady`, which is Clerk's SDK load
 * state. Forms disable submit until it flips true instead of failing on click.
 */

const NOT_READY = "Authentication is still loading. Try again in a moment.";

function firstClerkErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("errors" in error)) return undefined;
  const { errors } = error as { errors?: Array<{ code?: string }> };
  return Array.isArray(errors) ? errors[0]?.code : undefined;
}

export function useGoogleAuthMutation(redirectUrl: string) {
  const { signIn, isLoaded } = useSignIn();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isLoaded || !signIn) throw new AuthFlowError(NOT_READY);
      // Navigates away; nothing after this resolves in the current document.
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectUrl,
      });
    },
  });

  return { ...mutation, isReady: isLoaded };
}

export function useLoginMutation() {
  const { signIn, setActive, isLoaded } = useSignIn();

  const mutation = useMutation({
    mutationFn: async ({ email, password }: LoginValues) => {
      if (!isLoaded || !signIn || !setActive) throw new AuthFlowError(NOT_READY);

      const result = await signIn.create({ identifier: email, password });

      if (result.status !== "complete" || !result.createdSessionId) {
        throw new AuthFlowError(
          "Additional verification is required to finish signing in."
        );
      }

      await setActive({ session: result.createdSessionId });
    },
  });

  return { ...mutation, isReady: isLoaded };
}

/** Which verification step the account still owes after `signUp.create`. */
export type SignupVerification = "none" | "code" | "link";

/**
 * Creates the account and starts email verification. The returned step tells
 * the form what to render: instances configured for verification links reject
 * `email_code`, so that failure falls back rather than stranding a
 * half-created account.
 */
export function useSignupMutation() {
  const { signUp, setActive, isLoaded } = useSignUp();

  const mutation = useMutation({
    mutationFn: async ({ name, email, password }: SignupValues) => {
      if (!isLoaded || !signUp || !setActive) throw new AuthFlowError(NOT_READY);

      const [firstName, ...rest] = name.split(" ");
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName: rest.join(" "),
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return { verification: "none" as SignupVerification };
      }

      try {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        return { verification: "code" as SignupVerification };
      } catch {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_link",
          redirectUrl: `${window.location.origin}/login`,
        });
        return { verification: "link" as SignupVerification };
      }
    },
  });

  return { ...mutation, isReady: isLoaded };
}

/**
 * Re-sends the signup code. Restarting signup instead would hit
 * `form_identifier_exists` on the half-created account, so an expired code
 * needs its own escape hatch.
 */
export function useResendEmailCodeMutation() {
  const { signUp, isLoaded } = useSignUp();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isLoaded || !signUp) throw new AuthFlowError(NOT_READY);
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    },
  });

  return { ...mutation, isReady: isLoaded };
}

export function useVerifyEmailMutation() {
  const { signUp, setActive, isLoaded } = useSignUp();

  const mutation = useMutation({
    mutationFn: async ({ code }: VerifyEmailValues) => {
      if (!isLoaded || !signUp || !setActive) throw new AuthFlowError(NOT_READY);

      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status !== "complete" || !result.createdSessionId) {
        throw new AuthFlowError(
          "Verification could not be completed. Request a new code.",
          "code"
        );
      }

      await setActive({ session: result.createdSessionId });
    },
  });

  return { ...mutation, isReady: isLoaded };
}

/**
 * Sends the reset code. An unknown email resolves successfully on purpose:
 * the response must not reveal whether an account exists.
 */
export function useResetRequestMutation() {
  const { signIn, isLoaded } = useSignIn();

  const mutation = useMutation({
    mutationFn: async ({ email }: ResetRequestValues) => {
      if (!isLoaded || !signIn) throw new AuthFlowError(NOT_READY);

      try {
        await signIn.create({
          identifier: email,
          strategy: "reset_password_email_code",
        });
      } catch (error) {
        if (firstClerkErrorCode(error) !== "form_identifier_not_found") throw error;
      }
    },
  });

  return { ...mutation, isReady: isLoaded };
}

export function useResetPasswordMutation() {
  const { signIn, setActive, isLoaded } = useSignIn();

  const mutation = useMutation({
    mutationFn: async ({ code, password }: ResetPasswordValues) => {
      if (!isLoaded || !signIn || !setActive) throw new AuthFlowError(NOT_READY);

      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status !== "complete" || !result.createdSessionId) {
        throw new AuthFlowError(
          "Password reset could not be completed. Request a new code.",
          "code"
        );
      }

      await setActive({ session: result.createdSessionId });
    },
  });

  return { ...mutation, isReady: isLoaded };
}
