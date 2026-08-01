"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * InteractiveGridPattern is a component that renders a grid pattern with interactive squares.
 *
 * @param width - The width of each square.
 * @param height - The height of each square.
 * @param squares - The number of squares in the grid. The first element is the number of horizontal squares, and the second element is the number of vertical squares.
 * @param className - The class name of the grid.
 * @param squaresClassName - The class name of the squares.
 */
interface InteractiveGridPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontal, vertical]
  className?: string;
  squaresClassName?: string;
}

/**
 * The InteractiveGridPattern component.
 *
 * @see InteractiveGridPatternProps for the props interface.
 * @returns A React component.
 */
export function InteractiveGridPattern({
  width = 40,
  height = 40,
  squares = [24, 24],
  className,
  squaresClassName,
  ...props
}: InteractiveGridPatternProps) {
  const [horizontal, vertical] = squares;

  // Hover is pure CSS (the caller's squaresClassName supplies `hover:fill-*`).
  //
  // This used to hold `hoveredSquare` in state and attach onMouseEnter/onMouseLeave
  // to every rect, so one pointer move re-rendered all horizontal*vertical squares
  // — 3,200 of them at the landing page's [80, 40]. That was the dominant cost in a
  // ~1.4s INP on pointer. The state-driven fill was also dead: it was passed to cn()
  // ahead of squaresClassName, whose own `fill-*` won the twMerge conflict. So
  // removing it changes nothing visually and removes all per-pointer React work.
  const squareClass = useMemo(
    () =>
      cn(
        "fill-transparent stroke-gray-400/30 transition-all duration-100 ease-in-out [&:not(:hover)]:duration-1000",
        squaresClassName,
      ),
    [squaresClassName],
  );

  return (
    <svg
      viewBox={`0 0 ${width * horizontal} ${height * vertical}`}
      className={cn(
        "absolute inset-0 h-full w-full border border-gray-400/30",
        className,
      )}
      preserveAspectRatio="xMidYMid slice"
      {...props}
    >
      {Array.from({ length: horizontal * vertical }).map((_, index) => (
        <rect
          key={index}
          x={(index % horizontal) * width}
          y={Math.floor(index / horizontal) * height}
          width={width}
          height={height}
          className={squareClass}
        />
      ))}
    </svg>
  );
}

export type { InteractiveGridPatternProps };
