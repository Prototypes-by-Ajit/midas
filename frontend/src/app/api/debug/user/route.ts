import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('Debug endpoint called')
    const { userId } = await auth()
    console.log('Auth userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const client = await clerkClient()
    console.log('Clerk client obtained')

    const user = await client.users.getUser(userId)
    console.log('User fetched successfully:', user.id)

    return NextResponse.json({
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      privateMetadata: user.privateMetadata,
      publicMetadata: user.publicMetadata,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Debug error full:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    return NextResponse.json({
      error: 'Failed to fetch user',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
