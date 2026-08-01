import type { Variants } from "motion/react";

/**
 * The four scroll-reveal variants that were duplicated byte-for-byte across
 * privacy, terms and learn-more, each pointlessly wrapped in `useMemo(…, [])`
 * around a static object literal.
 *
 * The `import type` above is deliberate and load-bearing: it is erased at
 * compile time, so this module pulls no motion runtime and stays safe to
 * import from anywhere. Do not add a value import from "motion/react" here —
 * that would drag framer-motion into the RSC layer. This file also must NOT
 * carry "use client": a Server Component reading a non-component export from
 * a client module gets a client-reference proxy and throws.
 */

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export const slideInVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -50,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
};

export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: "backOut",
    },
  },
};
