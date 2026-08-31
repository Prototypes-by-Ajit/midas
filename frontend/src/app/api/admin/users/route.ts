import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// GET: Fetch all users from Clerk
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to check if they're admin
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userRole = (currentUser.privateMetadata?.role || currentUser.publicMetadata?.role) as string | undefined

    // Only admins can access user list
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Fetch all users from Clerk
    const { data: users } = await client.users.getUserList({
      limit: 500, // Adjust as needed
    })

    // Format user data
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || 'No email',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name',
      role: ((user.privateMetadata?.role || user.publicMetadata?.role) as string) || 'patient',
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      imageUrl: user.imageUrl,
    }))

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// PATCH: Update user role
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to check if they're admin
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userRole = (currentUser.privateMetadata?.role || currentUser.publicMetadata?.role) as string | undefined

    // Only admins can update roles
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { targetUserId, newRole } = body

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: 'Missing required fields: targetUserId, newRole' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'clinician', 'patient', 'ml_engineer', 'sre']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: admin, clinician, patient, ml_engineer, or sre' },
        { status: 400 }
      )
    }

    // Update user's public metadata with new role
    const updateClient = await clerkClient()
    await updateClient.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        role: newRole,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User role updated to ${newRole}`,
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    )
  }
}
