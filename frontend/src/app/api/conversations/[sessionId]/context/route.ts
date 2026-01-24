import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase env vars are missing")
  }

  return createClient(url, key, { auth: { persistSession: false } })
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

    const supabase = getSupabaseAdmin()

    // Verify user owns this session
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get recent messages (last 5)
    const { data: recentMessages, error: messagesError } = await supabase
      .from("messages")
      .select("id, role, content, created_at, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(5)

    if (messagesError) {
      console.error("[Context API] Error fetching messages:", messagesError)
    }

    // Get total message count
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)

    // Build simple summary from first few messages
    const messagesToSummarize = (recentMessages || []).slice(0, 3)
    const simpleSummary =
      messagesToSummarize.length > 0
        ? `Conversation about: ${messagesToSummarize
            .filter((m) => m.role === "user")
            .map((m) => m.content.substring(0, 50))
            .join(", ")}`
        : "New conversation"

    return NextResponse.json({
      cached: false,
      session_id: sessionId,
      recent_messages: (recentMessages || []).reverse(), // Return in chronological order
      summary: {
        summary: simpleSummary,
        updated_at: new Date().toISOString(),
        message_count: totalMessages || 0,
      },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    })
  } catch (error) {
    console.error("[Context API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
