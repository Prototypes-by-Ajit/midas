import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  { params }: { params: { sessionId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = params

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

    // Extract key topics and entities from user messages
    const userMessages = (recentMessages || []).filter((m) => m.role === "user")
    const assistantMessages = (recentMessages || []).filter((m) => m.role === "assistant")
    
    // Extract key medical terms and topics
    const medicalTerms = new Set<string>()
    const queryPatterns: string[] = []
    
    userMessages.forEach((msg) => {
      const content = msg.content.toLowerCase()
      // Detect common skin conditions
      const conditions = ["melanoma", "basal cell", "squamous cell", "actinic keratosis",
        "mole", "lesion", "skin cancer", "dermatology", "biopsy", "treatment"]
      conditions.forEach((term) => {
        if (content.includes(term)) medicalTerms.add(term)
      })
      
      // Track query intent
      if (content.includes("link") || content.includes("website") || content.includes("source")) {
        queryPatterns.push("information sources")
      }
      if (content.includes("symptom") || content.includes("sign")) {
        queryPatterns.push("symptom inquiry")
      }
      if (content.includes("treatment") || content.includes("therapy")) {
        queryPatterns.push("treatment options")
      }
      if (content.includes("diagnosis") || content.includes("detect")) {
        queryPatterns.push("diagnostic information")
      }
    })
    
    // Calculate average confidence from assistant messages
    const confidenceScores = assistantMessages
      .map((m) => m.metadata?.confidence)
      .filter((c) => typeof c === "number")
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0
    
    // Generate intelligent summary
    const topics = Array.from(medicalTerms)
    const intents = Array.from(new Set(queryPatterns))
    
    let intelligentSummary = ""
    if (topics.length > 0) {
      intelligentSummary = `User is inquiring about ${topics.slice(0, 3).join(", ")}.`
      if (intents.length > 0) {
        intelligentSummary += ` Focus areas: ${intents.join(", ")}.`
      }
      intelligentSummary += " Information retrieved from medical knowledge base and dermatology guidelines."
    } else {
      intelligentSummary = "General dermatology conversation. User exploring skin health topics."
    }
    
    // Extract sources from assistant message metadata
    const sources = new Set<string>()
    assistantMessages.forEach((msg) => {
      const citations = msg.metadata?.citations as Array<{source?: string}> | undefined
      if (citations && Array.isArray(citations)) {
        citations.forEach((c) => {
          if (c.source) sources.add(c.source)
        })
      }
    })

    return NextResponse.json({
      cached: false,
      session_id: sessionId,
      // Don't return raw messages, only metadata
      summary: {
        summary: intelligentSummary,
        updated_at: new Date().toISOString(),
        message_count: totalMessages || 0,
        topics: topics,
        query_patterns: intents,
        avg_confidence: Math.round(avgConfidence * 100),
        sources_used: Array.from(sources).slice(0, 5),
      },
      metadata: {
        total_messages: totalMessages || 0,
        user_questions: userMessages.length,
        assistant_responses: assistantMessages.length,
        avg_confidence_pct: Math.round(avgConfidence * 100),
      },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
  } catch (error) {
    console.error("[Context API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
