// Supabase Edge Function: Short-Term Conversation Cache
// Returns a compact, recent-memory window for a conversation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const DEFAULT_LIMIT = 8
const DEFAULT_TTL_SECONDS = 600
const MAX_LIMIT = 20
const MAX_TTL_SECONDS = 3600

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function parseJwt(authHeader: string | null): string | null {
  if (!authHeader) return null
  const [type, token] = authHeader.split(" ")
  if (type?.toLowerCase() !== "bearer" || !token) return null
  return token
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const jwt = parseJwt(req.headers.get("Authorization"))
    if (!jwt) {
      return jsonResponse({ error: "Missing Authorization token" }, 401)
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt)
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid JWT" }, 401)
    }

    const { session_id, limit, ttl_seconds, include_summary, action } = await req.json()
    if (!session_id) {
      return jsonResponse({ error: "session_id is required" }, 400)
    }

    const limitValue = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
    const ttlSeconds = Math.min(
      Math.max(Number(ttl_seconds) || DEFAULT_TTL_SECONDS, 60),
      MAX_TTL_SECONDS
    )

    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id, user_id")
      .eq("id", session_id)
      .eq("user_id", userData.user.id)
      .maybeSingle()

    if (sessionError) {
      return jsonResponse({ error: "Failed to load session" }, 500)
    }
    if (!sessionRow) {
      return jsonResponse({ error: "Session not found" }, 404)
    }

    if (action === "clear") {
      await supabaseAdmin
        .from("session_cache")
        .delete()
        .eq("session_id", session_id)

      return jsonResponse({ cleared: true })
    }

    if (action !== "refresh") {
      const { data: cached } = await supabaseAdmin
        .from("session_cache")
        .select("*")
        .eq("session_id", session_id)
        .maybeSingle()

      if (cached) {
        const expiresAt = new Date(cached.expires_at).getTime()
        if (expiresAt > Date.now()) {
          return jsonResponse({
            cached: true,
            session_id,
            recent_messages: cached.recent_messages ?? [],
            summary: cached.summary ?? null,
            expires_at: cached.expires_at,
          })
        }
      }
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at, metadata")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(limitValue)

    if (messagesError) {
      return jsonResponse({ error: "Failed to load messages" }, 500)
    }

    const recentMessages = (messages ?? []).slice().reverse()

    let summaryPayload: Record<string, unknown> | null = null
    if (include_summary) {
      const { data: summaryRow } = await supabaseAdmin
        .from("session_summaries")
        .select("summary, updated_at, message_count")
        .eq("session_id", session_id)
        .maybeSingle()

      if (summaryRow) {
        summaryPayload = {
          summary: summaryRow.summary,
          updated_at: summaryRow.updated_at,
          message_count: summaryRow.message_count,
        }
      }
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    const cachePayload = {
      session_id,
      recent_messages: recentMessages,
      summary: summaryPayload,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from("session_cache")
      .upsert(cachePayload, { onConflict: "session_id" })

    if (upsertError) {
      return jsonResponse({ error: "Failed to update cache" }, 500)
    }

    return jsonResponse({
      cached: false,
      session_id,
      recent_messages: recentMessages,
      summary: summaryPayload,
      expires_at: expiresAt,
    })
  } catch (error) {
    console.error("❌ conversation-cache error:", error)
    return jsonResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
