/**
 * PRD §17's admin analytics events (T061-T063). No analytics sink exists in
 * this app yet -- confirmed by grep, no `posthog`/`mixpanel`/`segment`/
 * `@vercel/analytics` dependency anywhere in `package.json` -- the same
 * undeployed-infra class as OQ7's telemetry stack. Every event here is a
 * structured `console.log` line, matching how this feature's other "emit"
 * requirements are already implemented (T019/T065's `policy_block_recorded`
 * log line, T024/T062-T063's own pre-existing failure logs). Upgrade path:
 * swap this function's body for a real sink call once one exists; every call
 * site stays the same.
 */
export function emitAdminEvent(event: string, fields: Record<string, unknown> = {}) {
  console.log(`[admin-analytics] ${event}`, fields)
}
