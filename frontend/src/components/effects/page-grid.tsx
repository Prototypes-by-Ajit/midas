import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/utils";

/**
 * Page-level grid backdrop shared by /privacy, /terms, /docs, /contact and /learn-more.
 *
 * Deliberately a plain import, not a dynamic() island. GridPattern is a ~70-line
 * static SVG whose only hook is useId(); it touches no browser API and renders
 * identically on the server. Splitting it would be the "dynamic-import a trivial
 * CSS-only component" anti-pattern and would drop the backdrop from first paint
 * for zero byte savings. (/terms did exactly that before this refactor.)
 *
 * No "use client" needed: GridPattern declares its own, and every prop passed
 * here is a serializable string or number, so a Server Component may render it.
 */
export default function PageGrid({ x = -1, y = -1 }: { x?: number; y?: number }) {
  return (
    <div className="absolute inset-0 z-0">
      <GridPattern
        width={40}
        height={40}
        x={x}
        y={y}
        className={cn(
          "[mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]",
          "opacity-100",
          "fill-gray-300/30 stroke-gray-400/50 dark:fill-gray-700/30 dark:stroke-gray-600/50"
        )}
      />
    </div>
  );
}
