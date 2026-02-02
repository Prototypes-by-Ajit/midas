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

  if (!url || !key) {
    throw new Error("Supabase admin env vars are missing")
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

const normalizeBackendUrl = (raw?: string | null) => {
  if (!raw) return null
  const trimmed = raw.replace(/\/$/, "")
  const withScheme = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
  return withScheme.endsWith("/api/v1") ? withScheme : `${withScheme}/api/v1`
}

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = params

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit") || 50)
    const offset = Number(searchParams.get("offset") || 0)

    const supabase = getSupabaseAdmin()
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError) {
      console.error('[API] Session lookup error:', sessionError)
      return NextResponse.json({ 
        error: "Failed to load session",
        details: sessionError.message 
      }, { status: 500 })
    }
    if (!sessionRow) {
      console.log('[API] Session not found (new session):', sessionId)
      // Return empty messages for new sessions instead of 404
      return NextResponse.json({
        session_id: sessionId,
        messages: [],
        total: 0,
      })
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, session_id, role, content, created_at, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (messagesError) {
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)

    return NextResponse.json({
      session_id: sessionId,
      messages: messages || [],
      total: count || 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    console.log('[API] POST message called')
    const { userId } = await auth()
    if (!userId) {
      console.error('[API] Message send failed: Not authenticated')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = params
    console.log('[API] Sending message to session:', { sessionId, userId })

    const body = await req.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }
    console.log('[API] Message content:', content.substring(0, 50))

    const supabase = getSupabaseAdmin()
    let { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json({ error: "Failed to load session" }, { status: 500 })
    }
    
    // Create session if it doesn't exist
    if (!sessionRow) {
      console.log('[API] Creating new session:', sessionId)
      const { data: newSession, error: createError } = await supabase
        .from("sessions")
        .insert({
          id: sessionId,
          user_id: userId,
          title: "New Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .select("id, user_id")
        .single()
      
      if (createError) {
        console.error('[API] Failed to create session:', createError)
        return NextResponse.json({ 
          error: "Failed to create session",
          details: createError.message 
        }, { status: 500 })
      }
      sessionRow = newSession
    }

    // DO NOT save user message here - backend will handle it
    // This prevents duplicate messages in the database

    const backendUrl = normalizeBackendUrl(process.env.BACKEND_URL || "http://localhost:8000")
    console.log('[API] Backend URL:', backendUrl)

    if (!backendUrl) {
      console.error('[API] Backend URL not configured')
      return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 })
    }

    console.log('[API] Calling backend:', `${backendUrl}/sessions/${sessionId}/messages`)
    const backendResponse = await fetch(
      `${backendUrl}/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: content,
          user_id: userId,
        }),
      }
    )

    console.log('[API] Backend response status:', backendResponse.status)
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => "Backend error")
      console.error('[API] Backend error:', errorText)
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: backendResponse.status }
      )
    }

    const backendData = await backendResponse.json()
    
    // DO NOT save assistant message here - backend already saved it
    // This prevents duplicate messages in the database

    // Update session last activity
    await supabase
      .from("sessions")
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    return NextResponse.json(backendData)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
