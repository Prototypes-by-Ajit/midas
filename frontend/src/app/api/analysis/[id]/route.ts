// API endpoint to delete a specific analysis
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate with Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const analysisId = params.id

    // 2. Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 3. Fetch the analysis to verify ownership
    const { data: analysis, error: fetchError } = await supabase
      .from('medical_analyses')
      .select('*')
      .eq('id', analysisId)
      .single()

    if (fetchError || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    // 4. Verify ownership
    if (analysis.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own analyses' },
        { status: 403 }
      )
    }

    // 5. Delete associated image from storage (if exists)
    if (analysis.image_url) {
      const storagePath = `${userId}/images/`
      const fileName = analysis.image_url.split('/').pop()

      if (fileName) {
        await supabase.storage
          .from('AI_image_storage')
          .remove([`${storagePath}${fileName}`])
      }
    }

    // 6. Delete heatmap from storage (if exists)
    if (analysis.heatmap_path) {
      await supabase.storage
        .from('AI_image_storage')
        .remove([analysis.heatmap_path])
    }

    // 7. Delete analysis from database
    const { error: deleteError } = await supabase
      .from('medical_analyses')
      .delete()
      .eq('id', analysisId)

    if (deleteError) {
      console.error('Failed to delete analysis:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete analysis', details: deleteError.message },
        { status: 500 }
      )
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      message: 'Analysis deleted successfully'
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
