/**
 * Route truth for /login: which form mode is active and where a signed-in user
 * is sent. Deliberately dependency-free — the security guard below is the one
 * piece of this feature that must be verifiable on its own.
 */

/** `/login?authmode=<mode>`. Mode is route state, not form state. */
export const AUTH_MODES = ["login", "signup", "resetpassword"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export const DEFAULT_REDIRECT_URL = "/dashboard";

/**
 * `redirect_url` arrives from the querystring (middleware sets it, but anyone
 * can craft it), and the auth forms hand it to `window.location`. Only
 * same-origin absolute paths are allowed: `//evil.com` and `/\evil.com` are
 * browser-valid protocol-relative URLs, so a bare `startsWith("/")` is not a
 * sufficient guard.
 */
export function safeRedirectUrl(value: string | string[] | undefined): string {
  if (typeof value !== "string") return DEFAULT_REDIRECT_URL;
  if (!/^\/[^/\\]/.test(value)) return DEFAULT_REDIRECT_URL;
  return value;
}

export function parseAuthMode(value: string | string[] | undefined): AuthMode {
  return AUTH_MODES.find((mode) => mode === value) ?? "login";
}

/** Mode switching is navigation, so it stays in the URL and carries the redirect through. */
export function authHref(mode: AuthMode, redirectUrl: string): string {
  const params = new URLSearchParams({ authmode: mode });
  if (redirectUrl !== DEFAULT_REDIRECT_URL) params.set("redirect_url", redirectUrl);
  return `/login?${params.toString()}`;
}
