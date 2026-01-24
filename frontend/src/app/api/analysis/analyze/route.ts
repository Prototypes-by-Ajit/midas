// API endpoint for medical image analysis
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

type SupabaseClient = ReturnType<typeof createClient<any>>

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

async function runDirectAnalysis(
  supabase: SupabaseClient,
  userId: string,
  imageFile: File
) {
  const timestamp = Date.now()
  const fileName = `${timestamp}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const storagePath = `${userId}/images/${fileName}`
  const fileBuffer = Buffer.from(await imageFile.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('AI_image_storage')
    .upload(storagePath, fileBuffer, {
      contentType: imageFile.type,
      upsert: false
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('AI_image_storage')
    .getPublicUrl(storagePath)

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('AI_image_storage')
    .createSignedUrl(storagePath, 600)

  if (signedUrlError || !signedUrlData) {
    throw new Error(`Signed URL failed: ${signedUrlError?.message || 'Unknown error'}`)
  }

  const { data: analysisRecord, error: insertError } = await supabase
    .from('medical_analyses')
    .insert({
      user_id: userId,
      image_name: imageFile.name,
      image_url: publicUrl,
      image_storage_path: storagePath,
      image_size: imageFile.size,
      status: 'processing',
      model_version: 'midas_v1_final'
    })
    .select()
    .single()

  if (insertError || !analysisRecord) {
    await supabase.storage.from('AI_image_storage').remove([storagePath])
    throw new Error(`Database insert failed: ${insertError?.message || 'Unknown error'}`)
  }

  // HARDCODED to bypass Next.js env caching issues
  const backendUrl = 'http://localhost:8000'
  const analyzeUrl = `${backendUrl}/api/v1/image/analyze`
  
  console.log('[Analysis API] Calling backend:', analyzeUrl)
  console.log('[Analysis API] Request body:', { analysis_id: analysisRecord.id, user_id: userId })

  const backendResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysis_id: analysisRecord.id,
      image_url: signedUrlData.signedUrl,
      user_id: userId
    })
  })

  if (!backendResponse.ok) {
    let errorMessage = `Backend returned ${backendResponse.status}`
    try {
      const errorData = await backendResponse.json()
      errorMessage = errorData.detail || errorData.error || errorMessage
      console.error('[Analysis API] Backend error:', errorData)
    } catch {
      const errorText = await backendResponse.text().catch(() => '')
      if (errorText) errorMessage = errorText
      console.error('[Analysis API] Backend error text:', errorText)
    }
    
    await supabase
      .from('medical_analyses')
      .update({ status: 'failed', error_message: `Backend error: ${errorMessage}` })
      .eq('id', analysisRecord.id)
    
    throw new Error(`Backend analysis failed: ${errorMessage}`)
  }

  const backendResult = await backendResponse.json()

  let heatmapPath: string | null = null
  let heatmapSignedUrl: string | null = null
  if (backendResult.heatmap_png_base64) {
    const heatmapBytes = Buffer.from(backendResult.heatmap_png_base64, 'base64')
    heatmapPath = `${userId}/heatmaps/${analysisRecord.id}_gradcam.png`
    let heatmapBucket = 'report_storage'

    const { error: heatmapUploadError } = await supabase.storage
      .from(heatmapBucket)
      .upload(heatmapPath, heatmapBytes, {
        contentType: 'image/png',
        upsert: true
      })

    if (heatmapUploadError) {
      heatmapBucket = 'AI_image_storage'
      const { error: fallbackUploadError } = await supabase.storage
        .from(heatmapBucket)
        .upload(heatmapPath, heatmapBytes, {
          contentType: 'image/png',
          upsert: true
        })

      if (fallbackUploadError) {
        heatmapPath = null
        heatmapBucket = ''
      }
    }

    if (heatmapPath && heatmapBucket) {
      const { data: heatmapSigned } = await supabase.storage
        .from(heatmapBucket)
        .createSignedUrl(heatmapPath, 3600)
      heatmapSignedUrl = heatmapSigned?.signedUrl || null
    }
  }

  await supabase
    .from('medical_analyses')
    .update({
      diagnosis: backendResult.diagnosis,
      confidence: backendResult.confidence,
      risk_level: backendResult.risk_level,
      detected_features: backendResult.detected_features,
      recommendations: backendResult.recommendations,
      classification_metrics: backendResult.classification_metrics || null,
      heatmap_path: heatmapPath,
      processing_time: backendResult.processing_time,
      status: 'completed'
    })
    .eq('id', analysisRecord.id)

  const { data: updatedAnalysis } = await supabase
    .from('medical_analyses')
    .select('*')
    .eq('id', analysisRecord.id)
    .single()

  return {
    success: true,
    analysis: {
      id: updatedAnalysis.id,
      diagnosis: updatedAnalysis.diagnosis,
      confidence: updatedAnalysis.confidence,
      risk_level: updatedAnalysis.risk_level,
      detected_features: updatedAnalysis.detected_features,
      recommendations: updatedAnalysis.recommendations,
      image_url: updatedAnalysis.image_url,
      heatmap_url: heatmapSignedUrl,
      classification_metrics: updatedAnalysis.classification_metrics,
      class_probabilities: backendResult.class_probabilities,
      processing_time: updatedAnalysis.processing_time,
      created_at: updatedAnalysis.created_at
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables' },
        { status: 500 }
      )
    }

    // 1. Authenticate with Clerk
    const { userId, getToken } = await auth()
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

    const supabase = createClient<any>(supabaseUrl, supabaseServiceKey)

    // 3. Call Supabase Edge Function for AI analysis (if Supabase JWT is available)
    const supabaseToken = await getToken({ template: 'supabase' }).catch(() => null)
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/analyze-image`

    const edgeFormData = new FormData()
    edgeFormData.append('image', imageFile)
    edgeFormData.append('user_id', userId)

    try {
      if (!supabaseToken) {
        throw new Error('Missing Supabase JWT for Edge Function')
      }

      const edgeResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseToken}`,
          'apikey': supabaseAnonKey || ''
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
      console.error('Edge Function call failed, falling back to direct analysis:', edgeError)
      const directResult = await runDirectAnalysis(supabase, userId, imageFile)
      return NextResponse.json(directResult)
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
