import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// GET: Get current user's role from privateMetadata
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    console.log('=== SERVER DEBUG ===')
    console.log('User ID:', user.id)
    console.log('Full user object keys:', Object.keys(user))
    console.log('privateMetadata:', JSON.stringify(user.privateMetadata, null, 2))
    console.log('publicMetadata:', JSON.stringify(user.publicMetadata, null, 2))

    const privateRole = user.privateMetadata?.role
    const publicRole = user.publicMetadata?.role

    console.log('privateRole extracted:', privateRole)
    console.log('publicRole extracted:', publicRole)

    const role = (privateRole || publicRole || 'patient') as string
    console.log('Final role:', role)
    console.log('===================\n')

    return NextResponse.json({ role })
  } catch (error) {
    console.error('Error fetching user role:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user role' },
      { status: 500 }
    )
  }
}
