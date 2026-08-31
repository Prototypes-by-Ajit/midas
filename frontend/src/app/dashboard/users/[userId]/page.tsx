import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Shield } from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, SectionHeading } from "@/components/clinical/page-header"

import { getSessionUser } from "@/services/auth.server"
import { getUserDetail } from "@/services/admin.server"

export const metadata: Metadata = {
  title: "User detail",
  description: "Access facts and activity for one user.",
}

export const dynamic = "force-dynamic"

/**
 * FR-USR-2. Server Component, entirely read-only — no client island needed.
 * The admin gate runs here, same pattern as the parent `/dashboard/users`
 * page; `getUserDetail` does not re-check role itself.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  const session = await getSessionUser()
  if (!session) redirect("/login")

  if (session.role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-critical" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don&apos;t have permission to access this page. Admin access is required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const result = await getUserDetail(userId, { id: session.userId, role: session.role })
  const result = await getUserDetail(userId)

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="User detail"
          crumbs={[{ label: "Users", href: "/dashboard/users" }, { label: "Detail" }]}
        />
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load this user. They may no longer exist.
        </p>
      </div>
    )
  }

  const user = result.data

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title={user.fullName}
        description={user.email}
        crumbs={[
          { label: "Users", href: "/dashboard/users" },
          { label: user.fullName },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="access-heading">
            <SectionHeading id="access-heading" title="Access facts" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm">
              <Fact term="Role" value={user.role} />
              <Fact
                term="Status"
                value={user.banned ? "Banned" : user.locked ? "Locked" : "Active"}
              />
              <Fact term="Multi-factor auth" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <Fact term="Password auth" value={user.passwordEnabled ? "Enabled" : "Disabled"} />
              <Fact term="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
              <Fact
                term="Last sign-in"
                value={user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Never"}
              />
            </dl>
          </section>

          <section aria-labelledby="audit-heading">
            <SectionHeading
              id="audit-heading"
              title="Recent activity"
              action={
                <Link
                  href={{ pathname: "/dashboard/admin/audit", query: { q: userId } }}
                  className="min-h-11 content-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Full audit trail
                </Link>
              }
            />
            <div className="rounded-xl border bg-card p-4">
              {user.auditActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit activity yet for this user.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {user.auditActivity.map((event) => (
                    <li key={event.id} className="text-sm">
                      <p className="font-medium text-foreground">{event.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.outcome} · {new Date(event.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            <SectionHeading id="audit-heading" title="Recent activity" />
            <div className="rounded-xl border bg-card p-4">
              {user.auditActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit activity yet for this user.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {user.auditActivity.map((event) => (
                    <li key={event.id} className="text-sm">
                      <p className="font-medium text-foreground">{event.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.outcome} · {new Date(event.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="sessions-heading">
            <SectionHeading id="sessions-heading" title="Active sessions" />
            <div className="rounded-xl border bg-card p-4">
              {user.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {user.sessions.map((s) => (
                    <li key={s.id} className="text-sm">
                      <p className="font-medium text-foreground">{s.device ?? "Unknown device"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.location ?? "Unknown location"} · last active{" "}
                        {new Date(s.lastActiveAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  )
}
