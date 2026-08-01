import { TRUST_BADGES } from "@/data/home/landing";

/**
 * The three green-dot trust signals, deduped from the landing hero and the
 * final CTA section.
 *
 * Renders the badge items only, not their container — the two call sites need
 * different containers (the hero uses a plain div with `justify-start`, the CTA
 * a `motion.div` with `justify-center`), and wrapping here would nest an extra
 * flex box inside each and break both layouts.
 */
export default function TrustBadges() {
  return (
    <>
      {TRUST_BADGES.map((badge) => (
        <div key={badge} className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>{badge}</span>
        </div>
      ))}
    </>
  );
}
