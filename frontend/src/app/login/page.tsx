import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AuthForm } from "@/features/auth/components/auth-form";
import { authHref, parseAuthMode, safeRedirectUrl } from "@/features/auth/utils/auth-route";

const LoginBackground = dynamic(() => import("@/components/effects/login-background"));

/**
 * Server manifest for /login. It owns route truth — which form mode is active
 * (`?authmode=`), where a signed-in user lands (`?redirect_url=`), the mode
 * switcher and the page chrome. Everything below the boundary lives in the
 * auth feature package.
 *
 * Signed-in visitors never reach this component: middleware.ts bounces
 * /login to /dashboard, so no client-side "already signed in" check is needed.
 */

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TITLES = {
  login: "Sign In",
  signup: "Create Account",
  resetpassword: "Reset Password",
} as const;

export async function generateMetadata({ searchParams }: LoginPageProps): Promise<Metadata> {
  const { authmode } = await searchParams;
  return { title: TITLES[parseAuthMode(authmode)] };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode = parseAuthMode(params.authmode);
  const redirectUrl = safeRedirectUrl(params.redirect_url);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <LoginBackground />
      <ThemeToggle />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Button asChild variant="ghost" className="mb-8">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>

          {mode !== "resetpassword" && (
            <nav className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <Button asChild variant={mode === "login" ? "default" : "ghost"} className="flex-1">
                <Link href={authHref("login", redirectUrl)}>Sign In</Link>
              </Button>
              <Button asChild variant={mode === "signup" ? "default" : "ghost"} className="flex-1">
                <Link href={authHref("signup", redirectUrl)}>Sign Up</Link>
              </Button>
            </nav>
          )}

          <AuthForm mode={mode} redirectUrl={redirectUrl} />

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            By {mode === "signup" ? "creating an account" : "continuing"}, you agree to our{" "}
            <Link href="/terms" className="text-blue-600 hover:underline dark:text-blue-500">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-500">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
