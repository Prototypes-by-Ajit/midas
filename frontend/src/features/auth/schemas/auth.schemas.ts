import { z } from "zod";

/**
 * Validation truth for every auth form. React Hook Form types are inferred from
 * these schemas — never hand-written alongside them.
 *
 * Input and output types are identical strings for every field (trim/lowercase
 * are string→string), so `useForm<z.infer<...>>` needs no transform generic.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** New/changed passwords only. Sign-in must not re-impose a policy the account may predate. */
const newPasswordField = z.string().min(8, "Password must be at least 8 characters.");

/** Paste-tolerant: strips spaces and dashes before the 6-digit check. */
const codeField = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required."),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters."),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({ code: codeField });

export const resetRequestSchema = z.object({ email: emailField });

export const resetPasswordSchema = z.object({
  code: codeField,
  password: newPasswordField,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
