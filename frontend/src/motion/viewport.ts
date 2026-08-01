import type { UseInViewOptions } from "motion/react";

/**
 * The two `useInView` presets used across the (home) route group — 38 of the
 * 46 call sites. The handful of one-off margins (-200px, -250px, -300px, 0px)
 * stay inline at their call site; they are contextually typed there.
 *
 * Type-only import, same reasoning as `./variants`.
 */

/** Page/section headers — reveals slightly before the element is fully in view. */
export const VIEW_ONCE_HEADER: UseInViewOptions = { once: true, margin: "-100px" };

/** Content sections — reveals a little later than headers. */
export const VIEW_ONCE_SECTION: UseInViewOptions = { once: true, margin: "-150px" };
