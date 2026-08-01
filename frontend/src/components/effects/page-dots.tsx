"use client";

import dynamic from "next/dynamic";

const DotPattern = dynamic(
  () => import("@/components/ui/dot-pattern").then((m) => m.DotPattern),
  { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden /> }
);

/**
 * Glowing dot backdrop for /contact.
 *
 * ssr:false is mandatory here, not an optimization: DotPattern measures its box
 * with getBoundingClientRect(), listens for resize, and seeds each dot's delay
 * with Math.random() — server rendering it emits zero circles and guarantees a
 * hydration mismatch.
 */
export default function PageDots() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <DotPattern
        width={24}
        height={24}
        cx={3}
        cy={2}
        cr={3}
        glow
        className="opacity-70 dark:opacity-70 text-foreground/20"
      />
    </div>
  );
}
