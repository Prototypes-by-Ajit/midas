import type { Query } from "@tanstack/react-query"

/**
 * Shared by the Overview (30s, FR-OV-1) and Health (15s, FR-HLT-1) poll
 * islands. `audit_events` is append-only (FR-AUD-1) -- a poll that kept
 * ticking after a 403 would write a fresh `refused` row every interval,
 * forever, into a table nothing can ever delete from. The page already
 * gates mounting the poll island on the *initial* SSR fetch having
 * succeeded (speckit-implement finding, Phase 10); this is the second,
 * cheaper defense for the rarer case of a role change mid-session.
 */
export class AdminApiError extends Error {
  status: number
  constructor(status: number) {
    super(`admin api request failed: ${status}`)
    this.status = status
  }
}

export function stopPollingOn403<T>(intervalMs: number) {
  return (query: Query<T, Error>) =>
    query.state.error instanceof AdminApiError && query.state.error.status === 403 ? false : intervalMs
}
