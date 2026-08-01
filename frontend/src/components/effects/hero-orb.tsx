"use client";

import dynamic from "next/dynamic";

const Orb = dynamic(() => import("@/components/ui/orb/index"), {
  ssr: false,
  loading: () => <div className="h-full w-full" aria-hidden />,
});

/**
 * ogl/WebGL orb behind the About hero — the only true heavy leaf in (home).
 *
 * The fallback matches the leaf's own root box (Orb renders `w-full h-full`)
 * rather than a pixel height. That is correct here, not a shortcut: the orb
 * sits inside `absolute inset-0`, entirely out of flow, and the hero's height
 * comes from its sibling `min-h-[60vh]` content overlay. No layout shift is
 * possible, and a hard-coded height would be wrong on any viewport where the
 * overlay exceeds 60vh.
 */
export default function HeroOrb() {
  return (
    <Orb
      className="w-full h-full"
      hue={0}
      hoverIntensity={0.2}
      rotateOnHover
      forceHoverState={false}
    />
  );
}
