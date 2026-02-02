import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  console.log('[API /conversations] Supabase config check:', {
    hasUrl: !!url,
    hasKey: !!key,
    urlPrefix: url?.substring(0, 20),
  })

  if (!url || !key) {
    const missing = []
    if (!url) missing.push('SUPABASE_URL')
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY')
    throw new Error(`Supabase admin env vars are missing: ${missing.join(', ')}`)
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: Request) {
  try {
    console.log('[API GET /conversations] Request started')

    const { userId } = await auth()
    console.log('[API GET /conversations] User ID:', userId)

    if (!userId) {
      console.error('[API GET /conversations] No user ID - unauthorized')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit") || 50)
    const offset = Number(searchParams.get("offset") || 0)
    console.log('[API GET /conversations] Params:', { limit, offset })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("sessions")
      .select("id, created_at, updated_at, last_activity_at, status, metadata")
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[API GET /conversations] Supabase error:', error)
      return NextResponse.json({
        error: "Failed to fetch conversations",
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('[API GET /conversations] Success - found', data?.length || 0, 'conversations')

    const conversations = (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_activity_at: row.last_activity_at,
      status: row.status,
      metadata: row.metadata,
    }))

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('[API GET /conversations] Unexpected error:', error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    console.log('[API] POST /api/conversations called')
    const { userId } = await auth()
    console.log('[API] User ID from auth:', userId)
    
    if (!userId) {
      console.error('[API] Conversation creation failed: User not authenticated')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('[API] Getting Supabase admin client...')
    const supabase = getSupabaseAdmin()
    const sessionId = crypto.randomUUID()

    console.log('[API] Creating session:', { sessionId, userId })
    const { error, data } = await supabase.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      status: "active",
    }).select()

    if (error) {
      console.error('[API] Supabase insert error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: "Failed to create conversation",
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 })
    }

    console.log('[API] Session created successfully:', { sessionId, data })
    return NextResponse.json({ session_id: sessionId })
  } catch (error) {
    console.error('[API] Unexpected error creating conversation:', error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
