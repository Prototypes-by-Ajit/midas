// Direct backend integration - bypasses Edge Function
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

import {
  REPORT_ABORT_MS,
  REPORT_NUMBER_PATTERN,
  errorBody,
  makeReportNumber,
} from '@/lib/reports/contract'
import { classifyBackendResult, finalizePatch, parseReportConfig } from '@/lib/reports/orchestration'

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

async function markReportFailed(reportId: string, errorMessage: string) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
  const { error } = await supabase
    .from('generated_reports')
    .update({ generation_status: 'failed', error_message: errorMessage })
    .eq('id', reportId)

  if (error) {
    console.error('Failed to mark report as failed:', error)
  }
}

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

    // 2. Parse request.
    //
    // Both checks run before anything is fetched, rendered or written, so a bad
    // request leaves no row, no document and no partial state behind (FR-012).
    const body = await request.json()
    const { analysis_id, config } = body

    if (!analysis_id) {
      return NextResponse.json(
        errorBody('INVALID_REQUEST', 'analysis_id is required'),
        { status: 400 }
      )
    }

    // Replaces `config?.reportType || 'diagnostic_summary'`. An unrecognised type
    // is now refused by name rather than quietly becoming a diagnostic summary,
    // and only the fields the contract declares reach `report_config`.
    const parsed = parseReportConfig(config)
    if (!parsed.ok) {
      return NextResponse.json(errorBody(parsed.code, parsed.message), { status: 422 })
    }

    const reportConfig = parsed.config
    const reportType = parsed.reportType

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

    // 6. Report number.
    //
    // The RPC is canonical and stays first. The client-side fallback was
    // `Math.random().toString(36).slice(2, 8)`, which yields six characters only
    // when the float's base-36 expansion happens to be long enough — `(0.5)`
    // expands to `"0.i"`, so the slice is a single character and migration 007's
    // CHECK rejects the insert. That surfaced as a 500 on someone who did nothing
    // wrong, at a rate nobody could reproduce on demand. `makeReportNumber` draws
    // a fixed count of characters, removing the variable length entirely (D11).
    const { data: rpcReportNumber } = await supabase.rpc('generate_report_number')
    const normalizedReportNumber = rpcReportNumber || makeReportNumber()

    // Checked here rather than discovered at insert time. A CHECK violation
    // arrives as an opaque constraint error attributed to the caller's request;
    // this names the real problem and writes nothing.
    if (!new RegExp(REPORT_NUMBER_PATTERN).test(normalizedReportNumber)) {
      console.error('Refusing to insert a non-canonical report number:', normalizedReportNumber)
      return NextResponse.json(
        errorBody('INTERNAL', 'A report number could not be generated. Nothing was saved.'),
        { status: 500 }
      )
    }

    // 7. Create report record
    const { data: reportRecord, error: insertError } = await supabase
      .from('generated_reports')
      .insert({
        user_id: userId,
        analysis_id: analysis.id,
        report_type: reportType,
        report_number: normalizedReportNumber,
        generation_status: 'generating',
        report_config: reportConfig
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

    // 8. Call backend to generate the PDF. A failure here must surface: a report
    // whose AI narrative failed to generate is not a report, and silently
    // substituting boilerplate makes it indistinguishable from a real one.
    let backendResponse: Response
    try {
      backendResponse = await fetch(new URL('/api/v1/reports/generate', BACKEND_URL), {
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
          report_number: normalizedReportNumber,
          config: reportConfig
        }),
        // The call was unbounded. A report service that accepted the connection
        // and never answered left the row on `generating` forever, and the person
        // watching an indefinite spinner had no way to tell that from slow.
        // Above the backend's own 180s LLM ceiling so a slow-but-succeeding
        // narrative is never cut off by its caller.
        signal: AbortSignal.timeout(REPORT_ABORT_MS)
      })
    } catch (backendError) {
      const timedOut =
        backendError instanceof Error &&
        (backendError.name === 'TimeoutError' || backendError.name === 'AbortError')
      const message = backendError instanceof Error ? backendError.message : 'Backend unreachable'

      console.error('Backend report service failed:', backendError)

      if (timedOut) {
        await markReportFailed(
          reportRecord.id,
          `The report service did not respond within ${Math.round(REPORT_ABORT_MS / 1000)} seconds.`
        )
        return NextResponse.json(
          errorBody(
            'GENERATION_FAILED',
            'The report took too long to generate and was stopped. Nothing was saved.'
          ),
          { status: 504 }
        )
      }

      await markReportFailed(reportRecord.id, `Report service unavailable: ${message}`)
      return NextResponse.json(
        errorBody(
          'SERVICE_UNAVAILABLE',
          'Report generation service is unavailable. Please try again.'
        ),
        { status: 503 }
      )
    }

    // What the service actually produced, read from its headers — the body is
    // PDF bytes, so this is the only way to learn whether the narrative was
    // complete without parsing the document. A 200 that says nothing about
    // itself classifies as `degraded`, never `completed`.
    const classification = classifyBackendResult(backendResponse)

    if (classification.generation_status === 'failed') {
      const errorText = await backendResponse.text()
      console.error('Backend error:', errorText)
      await markReportFailed(reportRecord.id, errorText.slice(0, 500))
      return NextResponse.json(
        errorBody(
          'GENERATION_FAILED',
          'The report could not be generated.',
          errorText.slice(0, 500)
        ),
        { status: 502 }
      )
    }

    // 9. Get PDF from backend
    const pdfBuffer = Buffer.from(await (await backendResponse.blob()).arrayBuffer())

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

      return NextResponse.json(
        errorBody('INTERNAL', 'The report was generated but could not be saved.'),
        { status: 500 }
      )
    }

    // 11. Generate signed URL for preview
    const { data: signedUrlData } = await supabase.storage
      .from('report_storage')
      .createSignedUrl(storagePath, 3600) // 1 hour

    // 12. Update report record.
    //
    // The patch carries the provenance columns as well as the status: without
    // them the `014` columns stay NULL on every new row, and the only record of
    // what the narrative produced would be a response header nobody kept.
    const patch = finalizePatch(classification, storagePath)

    const { error: finalizeError } = await supabase
      .from('generated_reports')
      .update(patch)
      .eq('id', reportRecord.id)

    // This error used to be discarded. A failed write meant the row stayed on
    // `generating` while the caller was told `success: true` — the report looked
    // finished to the person who asked for it and unfinished to every later
    // reader, which is the precise disagreement this feature exists to remove.
    if (finalizeError) {
      console.error('Failed to finalize report row:', finalizeError)
      return NextResponse.json(
        errorBody(
          'INTERNAL',
          'The report was generated but its status could not be recorded. It may not appear in your history.'
        ),
        { status: 500 }
      )
    }

    // 13. Return the outcome, whatever it was
    return NextResponse.json({
      success: true,
      report_id: reportRecord.id,
      report_number: reportRecord.report_number,
      report_type: reportType,
      generation_status: patch.generation_status,
      preview_url: signedUrlData?.signedUrl,
      generated_at: patch.generated_at,
      provenance: classification.provenance,
      message:
        patch.generation_status === 'degraded'
          ? 'Report generated with some sections missing'
          : 'Report generated successfully'
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
