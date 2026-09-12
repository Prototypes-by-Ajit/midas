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
 *
 * Light mode carries its own line colour, opacities and veil rather than reusing
 * dark's. blue-300 lines and a 70% white veil are tuned for a black backdrop; on
 * white they cancelled out and the backdrop rendered effectively blank. Keep the
 * two branches tuned separately -- collapsing them back to one value re-breaks
 * whichever theme did not get picked.
 *
 * RetroGrid's grid opacity has to come through className, not its `opacity` prop:
 * the leaf applies `opacity-[var(--opacity)]` and then cn()s className after it,
 * so tailwind-merge keeps ours and drops the prop's. Moving this to the prop
 * silently reverts it.
 */
export default function LoginBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div
      className="absolute inset-0 h-full w-full overflow-hidden motion-reduce:[&_*]:!animate-none"
      aria-hidden
    >
      <RetroGrid
        className="opacity-70 dark:opacity-40"
        angle={65}
        cellSize={65}
        lightLineColor="#3b82f6"
        darkLineColor="#93c5fd"
      />
      <Ripple
        className="opacity-50 dark:opacity-60"
        mainCircleSize={400}
        mainCircleOpacity={isDark ? 0.4 : 0.36}
        numCircles={6}
      />
      <Meteors number={25} minDelay={0} maxDelay={2} minDuration={1.5} maxDuration={3} angle={220} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-white/40 dark:from-black/40 dark:via-transparent dark:to-black/40" />
    </div>
  );
}
