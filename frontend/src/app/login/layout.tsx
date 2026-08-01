import { LoadingProvider } from "@/contexts/loading-context";

/**
 * Server Component so it can carry the segment config below (route segment
 * config is silently ignored on a "use client" file). LoadingProvider is a
 * client module; rendering it from here with children passing through is the
 * standard boundary pattern.
 *
 * force-dynamic is scoped to this one route so the auth page is never served
 * from a build-time-frozen artifact.
 *
 * The blank first paint this comment used to describe is gone: page.tsx is now
 * a Server Component that awaits searchParams instead of calling
 * useSearchParams() behind a Suspense fallback, so the card and its chrome are
 * server-rendered.
 */
export const dynamic = "force-dynamic";

export interface Layout {
  children: React.ReactNode;
}

export default function LoginLayout({ children }: Layout) {
  return (
    <LoadingProvider>
      <div className="min-h-screen">{children}</div>
    </LoadingProvider>
  );
}
