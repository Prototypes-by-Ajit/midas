"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricTile } from "@/components/clinical/metric-tile"
import { PageHeader } from "@/components/clinical/page-header"
import { ErrorState } from "@/components/clinical/states"
import {
  IconShieldLock,
  IconStethoscope,
  IconUsers,
  IconUserOff,
} from "@tabler/icons-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, UserCog, Users } from "lucide-react"
import type { ManagedUser as User } from "@/types/dashboard"
import { InviteDialog } from "@/components/admin/invite-dialog"
import { GovernedActionDialog, type GovernedAction } from "@/components/admin/governed-action-dialog"

/**
 * Admin user directory. The list, the admin gate, and the operator-only
 * filter are all resolved on the server (`page.tsx`) — this previously
 * fetched on mount behind a spinner and gated with `useRole()`.
 *
 * Role changes and offboarding go through `GovernedActionDialog`, which
 * calls the governed BFF routes (T039/T040) — reason required, last-admin
 * guarded, audited. The Select below no longer fires a role change directly
 * (T057, wiring the endpoints these routes have had since Phase 8 to
 * anything that actually calls them — nothing did before this).
 */
export default function UsersConsole({
  users,
  currentUserId,
  operatorOnly,
  fetchFailed,
}: {
  users: User[]
  currentUserId: string
  operatorOnly: boolean
  fetchFailed: boolean
}) {
  const [pendingAction, setPendingAction] = useState<GovernedAction | null>(null)

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'clinician':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'clinician':
        return <UserCog className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  // No loading branch: the list arrives with the server render, and
  // `app/dashboard/loading.tsx` covers the navigation gap.

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Users Management"
        description="Manage user roles and permissions"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Users" }]}
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/users/permissions"
              className="min-h-11 content-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Roles &amp; permissions
            </Link>
            <InviteDialog />
          </div>
        }
      />

      <div className="flex gap-1 border-b" role="tablist" aria-label="Directory scope">
        <TabLink href="/dashboard/users" active={!operatorOnly}>All users</TabLink>
        <TabLink href="/dashboard/users?view=operators" active={operatorOnly}>Operators only</TabLink>
      </div>

      {fetchFailed ? (
        <ErrorState title="Couldn't load the directory" body="Clerk didn't return a user list. Try reloading." />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile label="Total" value={users.length} icon={IconUsers} />
            <MetricTile
              label="Admins"
              value={users.filter((u) => u.role === 'admin').length}
              icon={IconShieldLock}
            />
            <MetricTile
              label="Clinicians"
              value={users.filter((u) => u.role === 'clinician').length}
              icon={IconStethoscope}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{operatorOnly ? "Operator accounts" : "All Users"}</CardTitle>
              <CardDescription>
                {operatorOnly
                  ? "Admin, ML Engineer, and SRE accounts only (FR-USR-1)."
                  : "Assign roles to control access level."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change role</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead><span className="sr-only">Offboard</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isSelf = user.id === currentUserId
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/users/${user.id}`}
                              className="flex items-center gap-3 hover:underline"
                            >
                              <Avatar>
                                <AvatarImage src={user.imageUrl} alt={user.fullName} />
                                <AvatarFallback>
                                  {user.fullName
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.fullName}</div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {user.id.slice(0, 8)}...
                                </div>
                              </div>
                            </Link>
                          </TableCell>

                          <TableCell>{user.email}</TableCell>

                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                              {getRoleIcon(user.role)}
                              {user.role}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => {
                                if (newRole === user.role) return
                                setPendingAction({ mode: "role_change", userId: user.id, userName: user.fullName, newRole })
                              }}
                              disabled={isSelf}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="patient">Patient</SelectItem>
                                <SelectItem value="clinician">Clinician</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="ml_engineer">ML Engineer</SelectItem>
                                <SelectItem value="sre">SRE</SelectItem>
                              </SelectContent>
                            </Select>
                            {isSelf && (
                              <p className="text-xs text-muted-foreground mt-1">
                                (You can&apos;t change your own role)
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            {user.lastSignInAt
                              ? new Date(user.lastSignInAt).toLocaleDateString()
                              : 'Never'}
                          </TableCell>

                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 text-critical hover:text-critical"
                              disabled={isSelf}
                              onClick={() => setPendingAction({ mode: "offboard", userId: user.id, userName: user.fullName })}
                              aria-label={`Offboard ${user.fullName}`}
                            >
                              <IconUserOff className="size-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <GovernedActionDialog action={pendingAction} onOpenChange={(open) => !open && setPendingAction(null)} />
    </div>
  )
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`min-h-11 content-center border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  )
}
