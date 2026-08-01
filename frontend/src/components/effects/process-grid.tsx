"use client";

import dynamic from "next/dynamic";

const InteractiveGridPattern = dynamic(
  () =>
    import("@/components/ui/interactive-grid-pattern/index").then(
      (m) => m.InteractiveGridPattern
    ),
  { ssr: false, loading: () => <div className="absolute inset-0 h-full w-full" aria-hidden /> }
);

/**
 * Hover grid behind the landing page's Process section.
 *
 * Split because at squares={[80, 40]} it emits 3,200 <rect> elements — a
 * decorative, below-the-fold backdrop that would otherwise sit in every HTML
 * response. The surrounding reveal animation and gradient overlay stay in
 * process-section.tsx so this wrapper holds nothing but the leaf.
 */
export default function ProcessGrid() {
  return (
    <InteractiveGridPattern
      width={30}
      height={30}
      squares={[80, 40]}
      className="opacity-30 dark:opacity-20 w-full h-full"
      squaresClassName="fill-gray-400/20 stroke-gray-400/40 hover:fill-primary/20 hover:stroke-primary/60 dark:fill-gray-600/20 dark:stroke-gray-600/40 dark:hover:fill-primary/30 dark:hover:stroke-primary/50"
    />
  );
}
