"use client"

import React, { useEffect, useId, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Upper bound on rendered dots per instance.
 *
 * The grid covers its container, which on a long page (e.g. /docs) is several
 * thousand pixels tall — at 16px spacing that is >20,000 nodes. Past this cap
 * the spacing is scaled up so density degrades gracefully instead of the node
 * count exploding. Short pages are unaffected.
 */
const MAX_DOTS = 3000

/**
 *  DotPattern Component Props
 *
 * @param {number} [width=16] - The horizontal spacing between dots
 * @param {number} [height=16] - The vertical spacing between dots
 * @param {number} [x=0] - The x-offset of the entire pattern
 * @param {number} [y=0] - The y-offset of the entire pattern
 * @param {number} [cx=1] - The x-offset of individual dots
 * @param {number} [cy=1] - The y-offset of individual dots
 * @param {number} [cr=1] - The radius of each dot
 * @param {string} [className] - Additional CSS classes to apply to the SVG container
 * @param {boolean} [glow=false] - Whether dots should have a glowing animation effect
 */
interface DotPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number
  height?: number
  x?: number
  y?: number
  cx?: number
  cy?: number
  cr?: number
  className?: string
  glow?: boolean
  [key: string]: unknown
}

/**
 * DotPattern Component
 *
 * A React component that creates an animated or static dot pattern background using SVG.
 * The pattern automatically adjusts to fill its container and can optionally display glowing dots.
 *
 * @component
 *
 * @see DotPatternProps for the props interface.
 *
 * @example
 * // Basic usage
 * <DotPattern />
 *
 * // With glowing effect and custom spacing
 * <DotPattern
 *   width={20}
 *   height={20}
 *   glow={true}
 *   className="opacity-50"
 * />
 *
 * @notes
 * - The component is client-side only ("use client")
 * - Automatically responds to container size changes
 * - When glow is enabled, dots will animate with random delays and durations
 * - Uses Motion for animations
 * - Dots color can be controlled via the text color utility classes
 */

export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
  ...props
}: DotPatternProps) {
  const id = useId()
  const containerRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Memoised: this used to run on every render, and because the delays come from
  // Math.random() the keys changed each time, remounting every dot.
  const dots = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return []

    // Scale spacing up if the container would produce more than MAX_DOTS.
    const rawCols = Math.ceil(dimensions.width / width)
    const rawRows = Math.ceil(dimensions.height / height)
    const scale = Math.max(1, Math.sqrt((rawCols * rawRows) / MAX_DOTS))
    const stepX = width * scale
    const stepY = height * scale

    const cols = Math.ceil(dimensions.width / stepX)
    const rows = Math.ceil(dimensions.height / stepY)

    return Array.from({ length: cols * rows }, (_, i) => ({
      x: (i % cols) * stepX + cx + x,
      y: Math.floor(i / cols) * stepY + cy + y,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }))
  }, [dimensions.width, dimensions.height, width, height, cx, cy, x, y])

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-neutral-400/80",
        className
      )}
      {...props}
    >
      <defs>
        <radialGradient id={`${id}-gradient`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((dot) => (
        <circle
          key={`${dot.x}-${dot.y}`}
          cx={dot.x}
          cy={dot.y}
          r={cr}
          fill={glow ? `url(#${id}-gradient)` : "currentColor"}
          className={glow ? "dot-glow" : undefined}
          style={
            glow
              ? {
                  animationDuration: `${dot.duration}s`,
                  animationDelay: `${dot.delay}s`,
                }
              : undefined
          }
        />
      ))}
    </svg>
  )
}
