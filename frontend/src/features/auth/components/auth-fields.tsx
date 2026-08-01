"use client";

import * as React from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Presentation-only field primitives for the auth package: label, icon, input,
 * inline error. They own no validation and no async state — the caller passes
 * `register(...)` and the message React Hook Form already resolved.
 */

interface FieldProps {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Rendered on the label row, e.g. a "Forgot password?" link. */
  action?: React.ReactNode;
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

/** Form-level failure: what went wrong with the submission as a whole. */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
    >
      {message}
    </div>
  );
}

function FieldShell({
  id,
  label,
  error,
  action,
  children,
}: Pick<FieldProps, "id" | "label" | "error" | "action"> & { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      <div className="relative">{children}</div>
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}

export function TextField({
  icon: Icon,
  type = "text",
  ...props
}: FieldProps & { icon: LucideIcon; type?: "text" | "email" }) {
  const { id, label, register, error, placeholder, autoComplete, disabled, autoFocus, action } =
    props;

  return (
    <FieldShell id={id} label={label} error={error} action={action}>
      <Icon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-500" aria-hidden />
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 pl-10"
        {...register}
      />
    </FieldShell>
  );
}

export function PasswordField({
  icon: Icon,
  ...props
}: FieldProps & { icon: LucideIcon }) {
  const { id, label, register, error, placeholder, autoComplete, disabled, action } = props;
  const [visible, setVisible] = React.useState(false);

  return (
    <FieldShell id={id} label={label} error={error} action={action}>
      <Icon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-500" aria-hidden />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 pl-10 pr-12"
        {...register}
      />
      {/* type="button" so toggling never submits and never touches the value. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        tabIndex={-1}
        className="absolute right-1 top-1 h-10 w-10"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </FieldShell>
  );
}

export function CodeField({
  id,
  label,
  register,
  error,
  disabled,
  autoFocus,
}: Omit<FieldProps, "placeholder" | "autoComplete" | "action">) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={7}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 text-center font-mono text-2xl tracking-widest"
        {...register}
      />
    </FieldShell>
  );
}
