import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = { sessionId: string }
const BACKEND_CHAT_TIMEOUT_MS = Number(process.env.BACKEND_CHAT_TIMEOUT_MS || 90000)

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

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

const isNvidiaProviderLookupError = (message: string): boolean => {
  return /not found for account|function .* not found|error code:\s*404/i.test(message)
}

const buildProviderErrorPayload = (message: string, sessionId: string) => ({
  answer: [
    "I’m currently unable to generate a final answer because the configured NVIDIA provider function is unavailable.",
    "Please retry in a minute or contact the backend administrator to verify NVIDIA function configuration.",
    "If this continues, use a shorter, clearer clinical question.",
    "This is educational information only. Please consult a qualified dermatologist for diagnosis."
  ].join(" "),
  citations: [],
  confidence: 0,
  route: "provider_error",
  session_id: sessionId,
  timestamp: new Date().toISOString(),
  model_used: "fallback",
  mode: "provider_error",
  confidence_breakdown: {
    final_confidence: 0.0,
    reason: "nvidia_provider_error",
  },
  details: message,
})

const buildLocalDemoPayload = (query: string, sessionId: string) => {
  const normalized = query.toLowerCase()
  const melanomaAnswer = [
    "Melanoma is the most serious type of skin cancer. It develops in melanocytes, the cells that produce melanin, the pigment that gives skin its color.",
    "",
    "Key features to watch for include the ABCDE signs: asymmetry, irregular borders, varied color, diameter larger than about 6 mm, and evolution or change over time.",
    "Melanoma may appear as a new mole or as a change in an existing mole. Early detection is important because early-stage melanoma is often highly treatable.",
    "",
    "This answer is from the local MIDAS demo knowledge base because the Python backend is currently unavailable.",
    "This is educational information only. Please consult a qualified dermatologist for proper diagnosis and treatment."
  ].join("\n")

  const generalAnswer = [
    "The backend assistant service is currently unavailable, so MIDAS is using its local demo knowledge base.",
    "For the demo, ask about melanoma, ABCDE warning signs, basal cell carcinoma, squamous cell carcinoma, biopsy, prevention, or skin cancer risk factors.",
    "",
    "This is educational information only. Please consult a qualified dermatologist for proper diagnosis and treatment."
  ].join("\n")

  // Every score here is null on purpose. Serving canned prose when the backend
  // is down is fine; attaching a confidence to it is not. These used to be
  // `normalized.includes("melanoma") ? 0.95 : 0.75` — a keyword match rendered
  // to the user as "95% confidence" with a green badge. Substituting content is
  // allowed in degraded mode; substituting a metric never is.
  return {
    answer: normalized.includes("melanoma") ? melanomaAnswer : generalAnswer,
    citations: [
      {
        source: "local_demo_knowledge_base",
        content: "Local MIDAS dermatology and skin-cancer demo knowledge base.",
        relevance_score: null,
      },
    ],
    confidence: null,
    route: "answer",
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    model_used: "local_demo_fallback",
    mode: "demo_fallback",
    confidence_breakdown: {
      final_confidence: null,
      reason: "backend_unavailable_local_demo_fallback",
    },
  }
}

const persistDemoMessages = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  sessionId: string,
  userContent: string,
  payload: ReturnType<typeof buildLocalDemoPayload>
) => {
  try {
    await supabase.from("messages").insert([
      {
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: userContent,
        metadata: {},
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: payload.answer,
        metadata: {
          route: payload.route,
          confidence: payload.confidence,
          citations: payload.citations,
          confidence_breakdown: payload.confidence_breakdown,
          model_used: payload.model_used,
          mode: payload.mode,
        },
      },
    ])

    await supabase
      .from("sessions")
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
  } catch (dbError) {
    console.error("[API] Failed to persist demo fallback messages:", dbError)
  }
}

const persistProviderErrorMessage = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  sessionId: string,
  payload: ReturnType<typeof buildProviderErrorPayload>
) => {
  try {
    await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: payload.answer,
        metadata: {
          route: payload.route,
          confidence: payload.confidence,
          citations: payload.citations,
          details: payload.details,
          confidence_breakdown: payload.confidence_breakdown,
          model_used: payload.model_used,
          mode: payload.mode,
        },
      })

    await supabase
      .from("sessions")
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
  } catch (dbError) {
    console.error("[API] Failed to persist provider_error assistant message:", dbError)
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<RouteParams> } // ✅ Next.js 15 fix
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params // ✅ Next.js 15 fix

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
      console.error("[API] Session lookup error:", sessionError)
      return NextResponse.json(
        { error: "Failed to load session", details: sessionError.message },
        { status: 500 }
      )
    }

    if (!sessionRow) {
      console.log("[API] Session not found (new session):", sessionId)
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
  { params }: { params: Promise<RouteParams> } // ✅ Next.js 15 fix
) {
  try {
    console.log("[API] POST message called")

    const { userId } = await auth()
    if (!userId) {
      console.error("[API] Message send failed: Not authenticated")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params // ✅ Next.js 15 fix
    console.log("[API] Sending message to session:", { sessionId, userId })

    const body = await req.json().catch(() => ({} as any))
    const content = String((body as any).content || "").trim()
    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }
    console.log("[API] Message content:", content.substring(0, 50))

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
      console.log("[API] Creating new session:", sessionId)

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
        console.error("[API] Failed to create session:", createError)
        return NextResponse.json(
          { error: "Failed to create session", details: createError.message },
          { status: 500 }
        )
      }

      sessionRow = newSession
    }

    // DO NOT save user message here - backend will handle it
    // This prevents duplicate messages in the database

    const backendUrl = normalizeBackendUrl(process.env.BACKEND_URL || "http://localhost:8000")
    console.log("[API] Backend URL:", backendUrl)

    if (!backendUrl) {
      console.error("[API] Backend URL not configured")
      return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 })
    }

    console.log("[API] Calling backend:", `${backendUrl}/sessions/${sessionId}/messages`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_CHAT_TIMEOUT_MS)
    let backendResponse: Response
    try {
      backendResponse = await fetch(`${backendUrl}/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: content,
          user_id: userId,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError"
      const message = timedOut
        ? `Backend request timed out after ${BACKEND_CHAT_TIMEOUT_MS}ms`
        : error instanceof Error
        ? error.message
        : String(error)

      console.error("[API] Backend request failed:", {
        backendUrl,
        sessionId,
        timedOut,
        message,
      })

      const fallback = buildLocalDemoPayload(content, sessionId)
      await persistDemoMessages(supabase, userId, sessionId, content, fallback)
      return NextResponse.json(fallback, { status: 200 })
    } finally {
      clearTimeout(timeoutId)
    }

    console.log("[API] Backend response status:", backendResponse.status)

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => "Backend error")
      console.error("[API] Backend error:", errorText)

      let parsedError: unknown = null
      try {
        parsedError = JSON.parse(errorText)
      } catch (_jsonErr) {
        parsedError = null
      }

      const candidateMessage = (() => {
        if (typeof parsedError === "string") {
          return parsedError
        }

        if (
          parsedError &&
          typeof parsedError === "object" &&
          "error" in parsedError
        ) {
          const rawError = (parsedError as { error?: unknown }).error
          if (typeof rawError === "string") {
            if (rawError.startsWith("Backend error: ")) {
              const innerText = rawError.replace(/^Backend error:\s*/, "")
              try {
                const innerPayload = JSON.parse(innerText)
                if (
                  innerPayload &&
                  typeof innerPayload === "object" &&
                  "detail" in innerPayload &&
                  typeof innerPayload.detail === "string"
                ) {
                  return innerPayload.detail
                }
              } catch (_innerErr) {
                return rawError
              }
            }
            return rawError
          }
        }

        if (
          parsedError &&
          typeof parsedError === "object" &&
          "detail" in parsedError &&
          typeof (parsedError as { detail?: unknown }).detail === "string"
        ) {
          return (parsedError as { detail: string }).detail
        }

        return errorText
      })()

      const normalizedStatus = backendResponse.status
      const normalizedMessage = (candidateMessage || "").toLowerCase()
      const hasProviderError = isNvidiaProviderLookupError(candidateMessage)
      const hasNotFoundToken = normalizedMessage.includes("nvidia") || normalizedMessage.includes("function")

      if ((normalizedStatus === 500 || normalizedStatus === 404) && hasProviderError && hasNotFoundToken) {
        console.warn("[API] Converting backend provider failure to fallback chat payload.")
        const fallback = buildProviderErrorPayload(candidateMessage, sessionId)
        await persistProviderErrorMessage(supabase, userId, sessionId, fallback)
        return NextResponse.json(fallback, { status: 200 })
      }

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
