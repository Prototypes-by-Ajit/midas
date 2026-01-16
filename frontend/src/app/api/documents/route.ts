import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/documents called')

    // 1. Authenticate user
    const { userId } = await auth()
    console.log('User ID:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check if user is clinician or admin
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const userRole = (user.privateMetadata?.role || user.publicMetadata?.role) as string | undefined

    if (userRole !== 'clinician' && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only clinicians can access documents' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseClient()

    // 3. Fetch documents from Supabase
    // Only get documents that have been uploaded as files (have storage_path)
    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_size, uploaded_by, created_at, status, lesion_class, storage_path')
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // 4. Format response
    const documents = data.map((doc) => ({
      id: doc.id,
      name: doc.file_name || 'Unnamed document',
      size: doc.file_size || 0,
      uploadedBy: doc.uploaded_by || 'Unknown',
      uploadedAt: doc.created_at,
      status: doc.status || 'pending',
      lesionClass: doc.lesion_class,
    }))

    return NextResponse.json({ documents }, { status: 200 })
  } catch (error: any) {
    console.error('Documents list error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
