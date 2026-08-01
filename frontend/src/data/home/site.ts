/**
 * Demo video embed URL (YouTube / Vimeo). An empty string renders the
 * "Demo Posting Soon" placeholder; set this to activate the iframe.
 *
 * The explicit `: string` annotation is load-bearing — without it TypeScript
 * infers the literal type `""`, which narrows the activation ternary to a
 * provably-false test.
 */
export const DEMO_VIDEO_URL: string = "";
