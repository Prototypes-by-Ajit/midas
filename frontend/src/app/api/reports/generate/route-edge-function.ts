// ============================================================================
// API Route: Generate Medical Report
// Purpose: Call Supabase Edge Function to generate report
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-report`

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

export async function POST(request: NextRequest) {
  try {
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

    // 3. Parse request body
    const body = await request.json()
    const { analysis_id, config } = body

    if (!analysis_id) {
      return NextResponse.json(
        { error: 'analysis_id is required' },
        { status: 400 }
      )
    }

    const callBackend = async () => {
      const backendResponse = await fetch(new URL('/api/v1/reports/generate', BACKEND_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BACKEND_API_KEY}`
        },
        body: JSON.stringify({
          analysis_id,
          report_type: config?.reportType || 'diagnostic_summary',
          user_id: userId,
          config
        })
      })

      if (!backendResponse.ok) {
        const backendErrorText = await backendResponse.text()
        return NextResponse.json(
          {
            error: 'Failed to generate report',
            details: backendErrorText
          },
          { status: backendResponse.status }
        )
      }

      const backendData = await backendResponse.json()
      return NextResponse.json(backendData)
    }

    // 4. Call Supabase Edge Function with user_id in body
    if (!supabaseToken) {
      console.warn('Supabase token missing, falling back to backend report generation')
      return await callBackend()
    }

    const edgeResponse = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseToken}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'x-clerk-user-id': userId
      },
      body: JSON.stringify({
        user_id: userId,
        analysis_id,
        config: config || {
          includeImages: true,
          includeDetailedFeatures: true,
          includeRecommendations: true,
          includeDisclaimer: true
        }
      })
    })

    // 5. Handle Edge Function response
    if (!edgeResponse.ok) {
      const errorData = await edgeResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Edge Function error:', errorData)

      // Fallback to backend if Edge Function fails
      return await callBackend()
    }

    // 6. Return success response
    const data = await edgeResponse.json()

    return NextResponse.json({
      success: true,
      report_id: data.report_id,
      report_number: data.report_number,
      preview_url: data.preview_url,
      report_type: data.report_type,
      generated_at: data.generated_at,
      message: 'Report generated successfully'
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

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
