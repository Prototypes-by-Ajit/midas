/**
 * The sign confirmation copy, to the word (T039).
 *
 * Lives here rather than inline in `components/clinical/sign-dialog.tsx` for a
 * reason the toolchain forced and that turned out to be the right shape anyway:
 * `tsconfig.json` sets `jsx: "preserve"` (the Next.js default), so vitest cannot
 * import a `.tsx` module, and copy that cannot be imported cannot be asserted.
 * Every other piece of clinical copy already lives under `data/clinical/` for the
 * same reason — see `case-presentation.ts`.
 *
 * FR-054: nothing here says verified, secure, or tamper-proof. The signature is
 * an attribution, and D1's digest detects that a stored document drifted from
 * what was signed. Neither proves who changed it, and describing either as
 * cryptographic verification would be a claim this system cannot support.
 * `sign-dialog.test.ts` asserts that, over this object and over the component's
 * source text.
 */
export const SIGN_DIALOG_COPY = {
  trigger: "Sign report",
  title: "Sign this report version?",
  description:
    "Signing attaches your name to this version permanently. It cannot be undone or edited. If a correction is needed later, you'll sign a new version instead.",
  /** The clause carrying the irreversibility, emphasised in the rendered output. */
  irreversible: "It cannot be undone or edited.",
  cancel: "Cancel",
  confirm: "Sign report",
  pending: "Signing\u2026",
  failed: "That signature could not be recorded. Nothing has been signed.",
} as const
