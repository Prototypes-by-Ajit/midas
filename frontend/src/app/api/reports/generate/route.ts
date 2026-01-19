// Direct backend integration - bypasses Edge Function
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function normalizeBackendBaseUrl(raw: string) {
  if (!raw) {
    throw new Error('BACKEND_URL is missing')
  }
  const trimmed = raw.trim()
  const withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
  return withScheme.replace(/\/api\/v1\/?$/, '')
}

const BACKEND_URL = normalizeBackendBaseUrl(
  process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || 'http://backend:8000'
)
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || 'test-key'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate with Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      )
    }

    // 2. Parse request
    const body = await request.json()
    const { analysis_id, config } = body
    const reportType = config?.reportType || 'diagnostic_summary'

    if (!analysis_id) {
      return NextResponse.json({ error: 'analysis_id is required' }, { status: 400 })
    }

    // 3. Create Supabase client (server-side with service key)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 4. Fetch analysis from Supabase
    const { data: analysis, error: analysisError } = await supabase
      .from('medical_analyses')
      .select('*')
      .eq('id', analysis_id)
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found', details: 'This analysis does not exist in the database' },
        { status: 404 }
      )
    }

    // 5. Check authorization (user must own the analysis)
    if (analysis.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 6. Generate report number
    const { data: reportNumber } = await supabase.rpc('generate_report_number')
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomToken = Math.random().toString(36).slice(2, 8).toUpperCase()
    const fallbackReportNumber = `MIDAS-REP-${dateStamp}-${randomToken}`
    const normalizedReportNumber = reportNumber || fallbackReportNumber

    // 7. Create report record
    const { data: reportRecord, error: insertError } = await supabase
      .from('generated_reports')
      .insert({
        user_id: userId,
        analysis_id: analysis.id,
        report_type: reportType,
        report_number: normalizedReportNumber,
        generation_status: 'generating',
        report_config: config
      })
      .select()
      .single()

    if (insertError || !reportRecord) {
      console.error('Failed to create report record:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to create report',
          details: insertError?.message || 'Unknown insert error'
        },
        { status: 500 }
      )
    }

    // 8. Call backend to generate PDF
    const backendResponse = await fetch(new URL('/api/v1/reports/generate', BACKEND_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BACKEND_API_KEY}`
      },
      body: JSON.stringify({
        report_id: reportRecord.id,
        analysis_id: analysis.id,
        report_type: reportType,
        user_id: userId,
        config: config
      })
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend error:', errorText)

      // Update report status to failed
      await supabase
        .from('generated_reports')
        .update({ generation_status: 'failed', error_message: errorText })
        .eq('id', reportRecord.id)

      return NextResponse.json(
        { error: 'PDF generation failed', details: errorText },
        { status: 500 }
      )
    }

    // 9. Get PDF from backend
    const pdfBlob = await backendResponse.blob()
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // 10. Upload PDF to Supabase Storage
    const storagePath = `${userId}/reports/${reportRecord.id}_${reportType}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('report_storage')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      await supabase
        .from('generated_reports')
        .update({ generation_status: 'failed', error_message: uploadError.message })
        .eq('id', reportRecord.id)

      return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 })
    }

    // 11. Generate signed URL for preview
    const { data: signedUrlData } = await supabase.storage
      .from('report_storage')
      .createSignedUrl(storagePath, 3600) // 1 hour

    // 12. Update report record
    await supabase
      .from('generated_reports')
      .update({
        storage_path: storagePath,
        generation_status: 'completed',
        generated_at: new Date().toISOString()
      })
      .eq('id', reportRecord.id)

    // 13. Return success
    return NextResponse.json({
      success: true,
      report_id: reportRecord.id,
      report_number: reportRecord.report_number,
      preview_url: signedUrlData?.signedUrl,
      report_type: reportType,
      generated_at: new Date().toISOString(),
      message: 'Report generated successfully'
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
