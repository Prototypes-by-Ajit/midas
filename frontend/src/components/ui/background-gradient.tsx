import { cn } from "@/lib/utils";
import React from "react";

const GRADIENT_LAYER =
  "bg-[radial-gradient(circle_farthest-side_at_0_100%,#ffffff,transparent),radial-gradient(circle_farthest-side_at_100%_0,#ffffff,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff,#000000)]";

/**
 * Static gradient border, revealed on hover.
 *
 * The panning animation was removed, not merely converted. It ran on
 * `background-position`, which cannot be composited — every frame repainted the
 * layer, and on the `blur-xl` copy that repaint re-ran a 24px blur over a
 * surface painted at `background-size: 400%`. /docs renders nine of these, so
 * that was 18 continuously repainting layers saturating the main thread for the
 * page's whole lifetime. It is why /docs stuttered while /contact and /privacy,
 * which use none, did not.
 *
 * Visually the loss is close to nil: both layers sit at opacity-20/10 under a
 * heavy blur, so the pan was barely perceptible. The hover reveal — a plain
 * opacity transition, which IS composited — is what the effect reads as, and
 * that is unchanged.
 */
export const BackgroundGradient = ({
  children,
  className,
  containerClassName,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  return (
    <div className={cn("relative p-[4px] group", containerClassName)}>
      <div
        className={cn(
          "absolute inset-0 rounded-3xl z-[1] opacity-20 group-hover:opacity-40 blur-xl transition duration-500",
          GRADIENT_LAYER,
        )}
      />
      <div
        className={cn("absolute inset-0 rounded-3xl z-[1] opacity-10", GRADIENT_LAYER)}
      />

      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
