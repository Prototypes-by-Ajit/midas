import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

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
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

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
      console.log('[API] Session not found:', sessionId)
      return NextResponse.json({ 
        error: "Session not found or access denied",
        session_id: sessionId 
      }, { status: 404 })
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
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    console.log('[API] POST message called')
    const { userId } = await auth()
    if (!userId) {
      console.error('[API] Message send failed: Not authenticated')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params
    console.log('[API] Sending message to session:', { sessionId, userId })

    const body = await req.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }
    console.log('[API] Message content:', content.substring(0, 50))

    const supabase = getSupabaseAdmin()
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json({ error: "Failed to load session" }, { status: 500 })
    }
    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { error: userInsertError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content,
      metadata: {},
    })

    if (userInsertError) {
      return NextResponse.json(
        {
          error: "Failed to save user message",
          details: userInsertError.message,
          code: userInsertError.code,
          hint: userInsertError.hint,
        },
        { status: 500 }
      )
    }

    // Get backend URL - HARDCODED to avoid Next.js caching issues
    const backendUrl = "http://localhost:8000/api/v1"
    console.log('[API] Backend URL (hardcoded):', backendUrl)

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
    const assistantContent = backendData.answer || backendData.content || ""

    const { error: assistantInsertError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: assistantContent,
      metadata: {
        citations: backendData.citations || [],
        confidence: backendData.confidence || backendData.confidence_score || 0,
        route: backendData.route || "answer",
      },
    })

    if (assistantInsertError) {
      return NextResponse.json(
        {
          error: "Failed to save assistant message",
          details: assistantInsertError.message,
          code: assistantInsertError.code,
          hint: assistantInsertError.hint,
        },
        { status: 500 }
      )
    }

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
