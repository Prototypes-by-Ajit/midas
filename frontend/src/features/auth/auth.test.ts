/**
 * Offline self-check for the pure half of the auth package: route guards,
 * schemas, error mapping. No Clerk, no DOM, no test framework.
 *
 *   node --experimental-strip-types src/features/auth/auth.test.ts
 *
 * Excluded from tsconfig by the `**\/*.test.ts` rule, which is why the relative
 * imports below carry explicit .ts extensions for Node's resolver.
 */
import assert from "node:assert/strict";

import {
  loginSchema,
  signupSchema,
  verifyEmailSchema,
} from "./schemas/auth.schemas.ts";
import { authHref, parseAuthMode, safeRedirectUrl } from "./utils/auth-route.ts";
import { mapAuthError } from "./utils/auth-error-map.ts";

// --- redirect guard: the one place a crafted query string reaches window.location
assert.equal(safeRedirectUrl("/dashboard/analysis"), "/dashboard/analysis");
assert.equal(safeRedirectUrl("//evil.com"), "/dashboard", "protocol-relative URL must be rejected");
assert.equal(safeRedirectUrl("/\\evil.com"), "/dashboard", "backslash form must be rejected");
assert.equal(safeRedirectUrl("https://evil.com"), "/dashboard");
assert.equal(safeRedirectUrl(undefined), "/dashboard");
assert.equal(safeRedirectUrl(["/a", "/b"]), "/dashboard");

// --- route mode
assert.equal(parseAuthMode("signup"), "signup");
assert.equal(parseAuthMode("nonsense"), "login");
assert.equal(parseAuthMode(undefined), "login");
assert.equal(authHref("signup", "/dashboard"), "/login?authmode=signup");
assert.equal(
  authHref("login", "/dashboard/reports"),
  "/login?authmode=login&redirect_url=%2Fdashboard%2Freports"
);

// --- schemas
const login = loginSchema.safeParse({ email: "  Doctor@Hospital.COM ", password: "x" });
assert.equal(login.success, true, "existing accounts must not be re-checked against a length policy");
assert.equal(login.data?.email, "doctor@hospital.com", "email is trimmed and lowercased");
assert.equal(loginSchema.safeParse({ email: "nope", password: "x" }).success, false);
assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "" }).success, false);

const mismatch = signupSchema.safeParse({
  name: "Jane Doe",
  email: "jane@example.com",
  password: "longenough",
  confirmPassword: "different",
});
assert.equal(mismatch.success, false);
assert.deepEqual(mismatch.error?.issues[0]?.path, ["confirmPassword"], "mismatch belongs to the field");

assert.equal(
  signupSchema.safeParse({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "short",
    confirmPassword: "short",
  }).success,
  false,
  "new passwords must be 8+ characters"
);

assert.equal(verifyEmailSchema.safeParse({ code: "123 456" }).data?.code, "123456");
assert.equal(verifyEmailSchema.safeParse({ code: "12345" }).success, false);

// --- error mapping (mapAuthError logs the raw error by design; keep the run quiet)
const realError = console.error;
console.error = () => {};
try {
  const unknownEmail = mapAuthError({ errors: [{ code: "form_identifier_not_found" }] }, "login");
  const wrongPassword = mapAuthError({ errors: [{ code: "form_password_incorrect" }] }, "login");
  assert.equal(
    unknownEmail.message,
    wrongPassword.message,
    "sign-in must not reveal whether an account exists"
  );
  assert.equal(unknownEmail.field, undefined, "credential failures are form-level, not field-level");

  assert.equal(mapAuthError({ errors: [{ code: "session_exists" }] }, "login").sessionExists, true);
  assert.equal(
    mapAuthError({ errors: [{ code: "form_identifier_exists" }] }, "signup").field,
    "email"
  );
  assert.equal(mapAuthError({ errors: [{ code: "form_code_incorrect" }] }, "verify").field, "code");

  const raw = mapAuthError(
    { errors: [{ code: "some_internal_code", message: "row 42 of table users blew up" }] },
    "login"
  );
  assert.ok(!raw.message.includes("row 42"), "backend strings must never reach the UI");

  assert.ok(mapAuthError(new TypeError("fetch failed"), "login").message.includes("Network"));
} finally {
  console.error = realError;
}

console.log("auth package checks passed");
