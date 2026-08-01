import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Raw Clerk errors never reach the UI. Every failure is mapped to a safe,
 * actionable message and, where it belongs to one input, to that field.
 *
 * Sign-in failures are deliberately collapsed to a single message so the form
 * cannot be used to probe which emails have accounts.
 */

export type AuthField = "name" | "email" | "password" | "confirmPassword" | "code";
export type AuthContext = "login" | "signup" | "verify" | "reset";

export interface MappedAuthError {
  /** Absent means form-level: render it above the submit button. */
  field?: AuthField;
  message: string;
  /** Clerk says a session already exists — the caller should just redirect. */
  sessionExists?: boolean;
}

/** Errors we throw ourselves. Their messages are authored for the user. */
export class AuthFlowError extends Error {
  readonly field?: AuthField;

  constructor(message: string, field?: AuthField) {
    super(message);
    this.name = "AuthFlowError";
    this.field = field;
  }
}

interface ClerkFieldError {
  code?: string;
  message?: string;
  longMessage?: string;
  meta?: { paramName?: string };
}

function firstClerkError(error: unknown): ClerkFieldError | undefined {
  if (!error || typeof error !== "object" || !("errors" in error)) return undefined;
  const { errors } = error as { errors?: ClerkFieldError[] };
  return Array.isArray(errors) ? errors[0] : undefined;
}

const GENERIC: Record<AuthContext, string> = {
  login: "Something went wrong signing you in. Please try again.",
  signup: "Something went wrong creating your account. Please try again.",
  verify: "Something went wrong verifying your email. Please try again.",
  reset: "Something went wrong resetting your password. Please try again.",
};

const INVALID_CREDENTIALS = "Invalid email or password.";
const INVALID_CODE = "That code is invalid or has expired. Request a new one.";

export function mapAuthError(error: unknown, context: AuthContext): MappedAuthError {
  // Keep the raw error inspectable without ever rendering it.
  console.error(`[auth:${context}]`, error);

  if (error instanceof AuthFlowError) {
    return { field: error.field, message: error.message };
  }

  if (error instanceof TypeError) {
    return { message: "Network error. Check your connection and try again." };
  }

  const clerkError = firstClerkError(error);
  if (!clerkError) return { message: GENERIC[context] };

  const code = clerkError.code ?? "";
  const text = (clerkError.message ?? "").toLowerCase();

  if (code === "session_exists" || text.includes("already signed in")) {
    return { sessionExists: true, message: "You are already signed in." };
  }

  if (code === "too_many_requests" || code === "rate_limit_exceeded") {
    return { message: "Too many attempts. Please wait a moment and try again." };
  }

  switch (code) {
    // Sign-in: unknown identifier and wrong password must be indistinguishable.
    case "form_identifier_not_found":
    case "form_password_incorrect":
      return context === "login"
        ? { message: INVALID_CREDENTIALS }
        : { message: GENERIC[context] };

    case "form_identifier_exists":
      return {
        field: "email",
        message: "An account with this email already exists. Sign in instead.",
      };

    case "form_password_pwned":
      return {
        field: "password",
        message: "This password appeared in a data breach. Choose a different one.",
      };

    case "form_password_not_strong_enough":
      return {
        field: "password",
        // Clerk's longMessage names the instance's actual policy; nothing sensitive in it.
        message: clerkError.longMessage ?? "Choose a stronger password.",
      };

    case "form_password_length_too_short":
      return { field: "password", message: "Password must be at least 8 characters." };

    case "form_code_incorrect":
    case "form_code_expired":
    case "verification_failed":
    case "verification_expired":
      return { field: "code", message: INVALID_CODE };

    case "form_param_format_invalid":
      return clerkError.meta?.paramName === "email_address"
        ? { field: "email", message: "Enter a valid email address." }
        : { message: GENERIC[context] };
  }

  if (context === "login" && (text.includes("not verified") || text.includes("verification"))) {
    return { message: "Verify your email address before signing in. Check your inbox." };
  }

  return { message: GENERIC[context] };
}

/**
 * Routes a mapped error into React Hook Form: onto its field when it has one,
 * otherwise onto `root` for the form-level alert.
 *
 * `mapAuthError` only ever names fields that exist in the form matching that
 * context, so the cast cannot address a field the caller does not render.
 */
export function applyAuthError<TFieldValues extends FieldValues>(
  error: unknown,
  context: AuthContext,
  setError: UseFormSetError<TFieldValues>,
  onSessionExists?: () => void
): void {
  const mapped = mapAuthError(error, context);

  if (mapped.sessionExists && onSessionExists) {
    onSessionExists();
    return;
  }

  setError((mapped.field ?? "root") as Path<TFieldValues>, { message: mapped.message });
}
