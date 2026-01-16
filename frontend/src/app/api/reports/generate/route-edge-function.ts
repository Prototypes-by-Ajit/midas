// ============================================================================
// API Route: Generate Medical Report
// Purpose: Call Supabase Edge Function to generate report
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-report`
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const USE_DIRECT_BACKEND = process.env.NEXT_PUBLIC_USE_DIRECT_BACKEND === 'true' || true // Use backend directly for now

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

    // 4. Call Supabase Edge Function with user_id in body
    const edgeResponse = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'x-clerk-user-id': userId  // Pass Clerk user ID in header
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

      return NextResponse.json(
        {
          error: errorData.error || 'Failed to generate report',
          details: errorData.details
        },
        { status: edgeResponse.status }
      )
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
