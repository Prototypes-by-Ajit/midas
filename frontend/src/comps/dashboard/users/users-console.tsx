"use client"



import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricTile } from "@/components/clinical/metric-tile"
import { PageHeader } from "@/components/clinical/page-header"
import {
  IconShieldLock,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Users, Shield, UserCog } from "lucide-react"
import type { ManagedUser as User } from "@/types/dashboard"

/**
 * Admin user directory. The list and the admin gate are both resolved on the
 * server, so a non-admin's HTML never contains the table — this previously
 * fetched on mount behind a spinner and gated with `useRole()`.
 *
 * `currentUserId` comes from the server session rather than Clerk's client
 * hook; it is only used to stop an admin demoting themselves.
 */
export default function UsersConsole({
  users,
  currentUserId,
  isAdmin,
}: {
  users: User[]
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setUpdatingUserId(targetUserId)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId,
          newRole,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update role')
      }

      toast.success("Success", {
        description: `User role updated to ${newRole}`,
      })

      // Clerk is the source of truth for roles; re-read it rather than patching
      // a local copy that could drift from what the next render returns.
      router.refresh()
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error("Error", {
        description: "Failed to update user role. Please try again.",
      })
    } finally {
      setUpdatingUserId(null)
    }
  }

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

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-critical" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page. Admin access is required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Users Management"
        description="Manage user roles and permissions"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Users" }]}
      />

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile label="Total users" value={users.length} icon={IconUsers} />
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Assign roles to users to control their access level
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
                  <TableHead>Assign Role</TableHead>
                  <TableHead>Last Sign In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    {/* User Info */}
                    <TableCell>
                      <div className="flex items-center gap-3">
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
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell>{user.email}</TableCell>

                    {/* Current Role Badge */}
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </TableCell>

                    {/* Role Selector */}
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        disabled={updatingUserId === user.id || user.id === currentUserId}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patient">Patient</SelectItem>
                          <SelectItem value="clinician">Clinician</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {user.id === currentUserId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          (You can't change your own role)
                        </p>
                      )}
                    </TableCell>

                    {/* Last Sign In */}
                    <TableCell>
                      {user.lastSignInAt
                        ? new Date(user.lastSignInAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}