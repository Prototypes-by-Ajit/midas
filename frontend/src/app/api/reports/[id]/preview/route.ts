// ============================================================================
// API Route: Preview Medical Report
// Purpose: Generate signed URL for PDF preview in iframe
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    // 1. Get authenticated user from Clerk
    const { userId, getToken } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get Supabase JWT token from Clerk
    const supabaseToken = await getToken({ template: 'supabase' })

    if (!supabaseToken) {
      return NextResponse.json(
        { error: 'Failed to get authentication token' },
        { status: 401 }
      )
    }

    // 3. Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseToken}`
        }
      }
    })

    // 4. Fetch report data with analysis info
    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select(`
        *,
        medical_analyses (
          diagnosis,
          confidence,
          risk_level,
          image_name
        )
      `)
      .eq('id', params.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // 5. Check if report is completed
    if (report.generation_status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Report not ready',
          status: report.generation_status,
          message: report.generation_status === 'failed'
            ? `Generation failed: ${report.error_message}`
            : 'Report is still being generated'
        },
        { status: 400 }
      )
    }

    // 6. Check if storage path exists
    if (!report.storage_path) {
      return NextResponse.json(
        { error: 'Report file not found' },
        { status: 404 }
      )
    }

    // 7. Generate signed URL for preview (1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('report_storage')
      .createSignedUrl(report.storage_path, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate preview URL' },
        { status: 500 }
      )
    }

    // 8. Return preview URL with metadata
    return NextResponse.json({
      success: true,
      report_id: report.id,
      report_number: report.report_number,
      report_type: report.report_type,
      preview_url: signedUrlData.signedUrl,
      expires_in: 3600,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      metadata: {
        generated_at: report.generated_at,
        diagnosis: (report.medical_analyses as any)?.diagnosis,
        confidence: (report.medical_analyses as any)?.confidence,
        risk_level: (report.medical_analyses as any)?.risk_level,
        image_name: (report.medical_analyses as any)?.image_name
      }
    })

  } catch (error) {
    console.error('Preview API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
