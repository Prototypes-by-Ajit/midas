"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const fallback = () => <div className="absolute inset-0" aria-hidden />;

const RetroGrid = dynamic(() => import("@/components/ui/retro-grid").then((m) => m.RetroGrid), {
  ssr: false,
  loading: fallback,
});

const Ripple = dynamic(() => import("@/components/ui/ripple").then((m) => m.Ripple), {
  ssr: false,
  loading: fallback,
});

const Meteors = dynamic(() => import("@/components/meteors").then((m) => m.Meteors), {
  ssr: false,
  loading: fallback,
});

/**
 * /login backdrop. Client wrapper only so `ssr: false` and `useTheme()` are
 * legal here instead of on the route; the three leaves own the animation work.
 *
 * ssr: false is required, not preferred: all three read window/theme state at
 * render and would mismatch the server HTML.
 */
export default function LoginBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden">
      <RetroGrid
        className="opacity-40"
        angle={65}
        cellSize={65}
        lightLineColor={isDark ? "#60a5fa" : "#3b82f6"}
        darkLineColor={isDark ? "#93c5fd" : "#60a5fa"}
      />
      <Ripple
        className="opacity-60"
        mainCircleSize={400}
        mainCircleOpacity={isDark ? 0.4 : 0.5}
        numCircles={6}
      />
      <Meteors number={25} minDelay={0} maxDelay={2} minDuration={1.5} maxDuration={3} angle={220} />
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40" />
    </div>
  );
}
