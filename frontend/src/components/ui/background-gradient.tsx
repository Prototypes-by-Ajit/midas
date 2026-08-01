import { cn } from "@/lib/utils";
import React from "react";

const GRADIENT_LAYER =
  "bg-[radial-gradient(circle_farthest-side_at_0_100%,#ffffff,transparent),radial-gradient(circle_farthest-side_at_100%_0,#ffffff,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff,#000000)]";

/**
 * Animated gradient border.
 *
 * The pan is a CSS animation (`animate-bg-gradient-pan`), not framer-motion.
 * /docs renders nine of these; as motion components that was 18 infinite
 * JS-driven animations over `background-position` on blurred layers, all on the
 * main thread. With no client-side dependency left this is a Server Component
 * again, so the nine card shells server-render.
 */
export const BackgroundGradient = ({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) => {
  return (
    <div className={cn("relative p-[4px] group", containerClassName)}>
      <div
        className={cn(
          "absolute inset-0 rounded-3xl z-[1] opacity-20 group-hover:opacity-40 blur-xl transition duration-500",
          GRADIENT_LAYER,
          animate && "animate-bg-gradient-pan",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-3xl z-[1] opacity-10",
          GRADIENT_LAYER,
          animate && "animate-bg-gradient-pan",
        )}
      />

      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
