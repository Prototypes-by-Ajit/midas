import { PageHeader, SectionHeading } from "@/components/clinical/page-header"
import { StatusBadge } from "@/components/clinical/status-badge"
import { formatRelativeTime } from "@/lib/utils/dateUtils"
import type { SecurityOverview } from "@/types/dashboard"

/**
 * Account security posture. Server Component — every value comes from Clerk via
 * `services/security.server.ts`; nothing here is hardcoded.
 *
 * The previous version of this page shipped a "Revoke" and "Revoke All Other
 * Sessions" button with no handler attached, next to three invented sessions.
 * Both are gone: a control that silently does nothing on a security panel is
 * worse than no control, because a user who clicks it believes the session was
 * ended. Add them back with `clerk.sessions.revokeSession()` behind a route
 * handler, not as decoration.
 */
export function SecurityConsole({
  overview,
  loadFailed,
}: {
  overview: SecurityOverview | null
  loadFailed: boolean
}) {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Security & Privacy"
        description="Your account protection and the devices currently signed in."
      />

      {loadFailed || !overview ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Could not load your security details. Refresh to try again.
        </p>
      ) : (
        <>
          <section aria-labelledby="account-protection-heading">
            <SectionHeading
              id="account-protection-heading"
              title="Account protection"
            />
            <ul className="divide-y rounded-xl border bg-card">
              <li className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    Two-factor authentication
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    A second step at sign-in, beyond your password.
                  </p>
                </div>
                <StatusBadge
                  tone={overview.twoFactorEnabled ? "success" : "warning"}
                  dot
                  className="shrink-0"
                >
                  {overview.twoFactorEnabled ? "Enabled" : "Not enabled"}
                </StatusBadge>
              </li>
              <li className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">Password</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Not set means this account signs in only through a connected
                    provider.
                  </p>
                </div>
                <StatusBadge
                  tone={overview.passwordEnabled ? "success" : "neutral"}
                  dot
                  className="shrink-0"
                >
                  {overview.passwordEnabled ? "Set" : "Not set"}
                </StatusBadge>
              </li>
            </ul>
          </section>

          <section aria-labelledby="active-sessions-heading">
            <SectionHeading
              id="active-sessions-heading"
              title="Active sessions"
            />
            {overview.sessions.length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                No active sessions reported.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {overview.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {/* Clerk did not report device detail — say so rather
                            than guessing a device name. */}
                        {session.device ?? "Unknown device"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.location ?? "Unknown location"} ·{" "}
                        {formatRelativeTime(session.lastActiveAt)}
                      </p>
                    </div>
                    {session.current && (
                      <StatusBadge tone="active" dot className="shrink-0">
                        This device
                      </StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
