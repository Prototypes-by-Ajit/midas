// API endpoint for medical image analysis
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables' },
        { status: 500 }
      )
    }

    // 1. Authenticate with Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse multipart form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (imageFile.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // 3. Call Supabase Edge Function for AI analysis
    console.log('Calling Edge Function for analysis...')

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/analyze-image`

    const edgeFormData = new FormData()
    edgeFormData.append('image', imageFile)
    edgeFormData.append('user_id', userId)

    // 4. Call Edge Function for AI analysis
    try {
      const edgeResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: edgeFormData
      })

      if (!edgeResponse.ok) {
        const errorData = await edgeResponse.json()
        console.error('Edge Function error:', errorData)

        throw new Error(errorData.error || 'Edge Function returned an error')
      }

      const analysisData = await edgeResponse.json()

      if (!analysisData.success || !analysisData.analysis) {
        throw new Error('Invalid response from Edge Function')
      }

      // 5. Return analysis results
      return NextResponse.json({
        success: true,
        analysis: analysisData.analysis
      })

    } catch (edgeError) {
      console.error('Edge Function call failed:', edgeError)

      return NextResponse.json(
        {
          error: 'AI analysis failed',
          details: edgeError instanceof Error ? edgeError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

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
