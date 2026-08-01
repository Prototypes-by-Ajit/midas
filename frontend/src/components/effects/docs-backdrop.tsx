"use client";

import dynamic from "next/dynamic";

const DotPattern = dynamic(
  () => import("@/components/ui/dot-pattern").then((m) => m.DotPattern),
  { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden /> }
);

/**
 * /docs backdrop: a gradient wash plus two DotPattern layers — coarse for
 * presence, fine for depth. Both layers resolve the same lazy module, so
 * webpack emits one shared chunk: still exactly one lazy step.
 *
 * See page-dots.tsx for why ssr:false is required rather than merely preferred.
 */
export default function DocsBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

      <DotPattern
        width={32}
        height={32}
        cx={3}
        cy={2}
        cr={3}
        glow
        className="opacity-50 dark:opacity-40 text-primary/60 dark:text-primary/40"
      />

      <DotPattern
        width={16}
        height={16}
        cx={0.2}
        cy={0.2}
        cr={0.5}
        glow
        className="opacity-20 dark:opacity-15 text-secondary/50 dark:text-secondary/30"
      />
    </div>
  );
}
