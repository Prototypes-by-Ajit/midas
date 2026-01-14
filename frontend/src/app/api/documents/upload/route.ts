import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'Multiagent_Skincancer_RAG'

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check if user is clinician
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const userRole = (user.privateMetadata?.role || user.publicMetadata?.role) as string | undefined

    if (userRole !== 'clinician') {
      return NextResponse.json(
        { error: 'Only clinicians can upload documents' },
        { status: 403 }
      )
    }

    // 3. Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 4. Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, TXT, and MD files are allowed.' },
        { status: 400 }
      )
    }

    // 5. Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // 6. Generate unique file path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${userId}/${timestamp}_${sanitizedFileName}`

    // 7. Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // 8. Insert metadata into documents table
    const { data: docData, error: dbError } = await supabase
      .from('documents')
      .insert({
        title: file.name,
        file_name: file.name,
        content: '', // Content will be extracted during processing
        storage_path: storagePath,
        file_size: file.size,
        uploaded_by: user.emailAddresses[0]?.emailAddress || userId,
        source: 'clinician_upload',
        source_type: 'file',
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Cleanup: delete uploaded file if DB insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      return NextResponse.json(
        { error: 'Failed to save document metadata' },
        { status: 500 }
      )
    }

    // Trigger Edge Function for automatic processing
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`

      // Don't await - let it process in background
      fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          document_id: docData.id,
          storage_path: storagePath,
        }),
      }).catch(err => {
        console.error('Failed to trigger Edge Function:', err)
        // Don't fail the upload if Edge Function trigger fails
      })

      console.log('Document processing triggered via Edge Function')
    } catch (error) {
      console.error('Error triggering Edge Function:', error)
      // Don't fail the upload if processing trigger fails
    }

    return NextResponse.json(
      {
        message: 'Document uploaded successfully',
        document: {
          id: docData.id,
          name: file.name,
          size: file.size,
          status: 'pending',
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
