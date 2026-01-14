import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'Multiagent_Skincancer_RAG'

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
        { error: 'Only clinicians can delete documents' },
        { status: 403 }
      )
    }

    // 3. Get document ID from params
    const params = await context.params
    const documentId = params.id

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // 4. Fetch document to get storage path
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      console.error('Document fetch error:', fetchError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 5. Delete file from Supabase Storage
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([document.storage_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // 6. Delete embeddings associated with this document
    const { error: embeddingsError } = await supabase
      .from('embeddings')
      .delete()
      .eq('document_id', documentId)

    if (embeddingsError) {
      console.error('Embeddings deletion error:', embeddingsError)
      // Continue with document deletion even if embeddings deletion fails
    }

    // 7. Delete document metadata from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      console.error('Document deletion error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Document deleted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
