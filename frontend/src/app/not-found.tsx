// "use client";

import Link from "next/link";

import dynamic from "next/dynamic";

// Lazy-load client-only Meteors (no SSR to avoid WebGL on server)
// const Meteors = dynamic(() => import("@/components/meteors").then(mod => mod.Meteors), {
//   ssr: false,
//   loading: () => <div className="fixed inset-0 z-10" />, // lightweight fallback
// });

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-black">
      {/* <Meteors
        number={20}
        minDelay={0.2}
        maxDelay={1.2}
        minDuration={2}
        maxDuration={10}
        angle={215}
      /> loads on the client, after HTML is streamed */}
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white">404 — Not Found</h1>
          <p className="text-white">The page you’re looking for doesn’t exist.</p>
          <Link href="/" className="inline-block rounded-lg border px-4 py-2 text-white">
            Go Home
          </Link>
        </div>
      </main>
    </div>
  );
}
