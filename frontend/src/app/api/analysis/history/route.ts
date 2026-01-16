// API endpoint to fetch user's analysis history from database
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate with Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      )
    }

    // 2. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Fetch user's analysis history
    const { data: analyses, error } = await supabase
      .from('medical_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch analyses:', error)
      return NextResponse.json(
        { error: 'Failed to fetch analysis history', details: error.message },
        { status: 500 }
      )
    }

    const analysesWithHeatmaps = await Promise.all(
      (analyses || []).map(async (analysis) => {
        if (!analysis.heatmap_path) {
          return { ...analysis, heatmap_url: null }
        }
        const { data: primarySigned, error: primaryError } = await supabase.storage
          .from('report_storage')
          .createSignedUrl(analysis.heatmap_path, 3600)

        if (primarySigned?.signedUrl) {
          return { ...analysis, heatmap_url: primarySigned.signedUrl }
        }

        if (primaryError) {
          console.warn('Heatmap signed URL error (report_storage):', primaryError.message)
        }

        const { data: fallbackSigned } = await supabase.storage
          .from('AI_image_storage')
          .createSignedUrl(analysis.heatmap_path, 3600)
        return { ...analysis, heatmap_url: fallbackSigned?.signedUrl || null }
      })
    )

    // 4. Return analysis history
    return NextResponse.json({
      success: true,
      analyses: analysesWithHeatmaps
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
