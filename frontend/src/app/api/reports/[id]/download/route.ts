// ============================================================================
// API Route: Download Medical Report
// Purpose: Generate signed URL and stream PDF for download
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    // 1. Get authenticated user from Clerk
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Ensure Supabase service key is configured
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase service key not configured' },
        { status: 500 }
      )
    }

    // 3. Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 4. Fetch report data
    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', params.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // 5. Check authorization (owner or clinician)
    if (report.user_id !== userId && report.clinician_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 6. Check if report is completed
    if (report.generation_status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Report not ready',
          status: report.generation_status
        },
        { status: 400 }
      )
    }

    // 7. Check if storage path exists
    if (!report.storage_path) {
      return NextResponse.json(
        { error: 'Report file not found' },
        { status: 404 }
      )
    }

    // 8. Generate signed URL for download (5 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('report_storage')
      .createSignedUrl(report.storage_path, 300, {
        download: `${report.report_number}.pdf`
      })

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    // 9. Fetch the PDF from signed URL
    const pdfResponse = await fetch(signedUrlData.signedUrl)

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch PDF file' },
        { status: 500 }
      )
    }

    // 10. Get PDF blob
    const pdfBlob = await pdfResponse.blob()
    const arrayBuffer = await pdfBlob.arrayBuffer()

    // 11. Return PDF with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.report_number}.pdf"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Download API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
