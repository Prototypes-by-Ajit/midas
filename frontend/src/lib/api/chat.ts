/*** API service for MIDAS RAG backend integration**/

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || 'http://localhost:8000';

const API_ROOT = API_BASE_URL.endsWith('/api/v1')
  ? API_BASE_URL
  : `${API_BASE_URL.replace(/\/$/, '')}/api/v1`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getSupabaseFunctionUrl = (path: string) => {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${path}`;
};

const buildSupabaseHeaders = (supabaseToken?: string | null) => {
  if (!SUPABASE_ANON_KEY) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    ...(supabaseToken ? { 'Authorization': `Bearer ${supabaseToken}` } : {}),
    'apikey': SUPABASE_ANON_KEY,
  };
};

export interface ChatRequest {
  query: string;
  session_id?: string;
}

export interface Citation {
  source: string;
  content: string;
  relevance_score: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  route: 'answer' | 'clarify' | 'refuse';
  session_id?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  models_loaded: boolean;
  vector_store_ready: boolean;
  timestamp: string;
}

const APP_API_ROOT = "/api/conversations";

export interface ConversationResponse {
  conversations: Array<{
    id: string;
    title?: string | null;
    created_at: string;
    updated_at?: string | null;
    last_activity_at?: string | null;
    message_count?: number;
    status?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ConversationMessagesResponse {
  session_id: string;
  messages: Array<{
    id: string;
    session_id: string;
    role: string;
    content: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
  total: number;
}

export interface ConversationContextResponse {
  cached: boolean;
  session_id: string;
  recent_messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
  summary?: {
    summary: string;
    updated_at?: string;
    message_count?: number;
    topics?: string[];
    query_patterns?: string[];
    sources_used?: string[];
    avg_confidence?: number;
  } | null;
  metadata?: {
    total_messages: number;
    user_questions: number;
    avg_confidence_pct: number;
    assistant_responses?: number;
  } | null;
  expires_at: string;
}

const appFetch = async (path: string, options?: RequestInit) => {
  let response: Response;

  try {
    console.log("[API Client] Making request:", { path, method: options?.method || 'GET' });

    response = await fetch(path, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    console.log("[API Client] Response received:", {
      path,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });
  } catch (error) {
    console.error("[API Client] Network error:", {
      path,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error("Network error. Please check your connection.");
  }

  if (!response.ok) {
    let errorBody: Record<string, unknown> | null = null;
    let errorText = "";
    let rawText = "";

    try {
      const contentType = response.headers.get("content-type") || "";
      console.log("[API Client] Error response content-type:", contentType);

      // ALWAYS read as text first to see what we're dealing with
      rawText = await response.text();
      console.log("[API Client] Raw error response (length:", rawText.length, "):", rawText.substring(0, 500));

      // Try to parse as JSON if it looks like JSON
      if (contentType.includes("application/json") && rawText.trim()) {
        try {
          errorBody = JSON.parse(rawText);
          console.log("[API Client] Parsed JSON error body:", errorBody);
        } catch (jsonError) {
          console.error("[API Client] JSON parse failed:", jsonError);
          errorText = rawText;
        }
      } else {
        errorText = rawText;
      }
    } catch (parseError) {
      console.error("[API Client] Could not read error response:", parseError);
      errorText = "(could not read response)";
    }

    const errorMessage =
      (errorBody?.error as string | undefined)
      || (errorBody?.detail as string | undefined)
      || (errorBody?.message as string | undefined)
      || errorText.trim()
      || rawText.trim()
      || `HTTP ${response.status} ${response.statusText}`;

    // Log EVERYTHING about the error
    console.error("[API Client] ========== REQUEST FAILED ==========");
    console.error("[API Client] Path:", path);
    console.error("[API Client] Status:", response.status, response.statusText);
    console.error("[API Client] Raw Response:", rawText);
    console.error("[API Client] Error Message:", errorMessage);
    console.error("[API Client] Error Body:", errorBody);
    console.error("[API Client] Error Text:", errorText || "(none)");
    console.error("[API Client] Full Details:", {
      path,
      status: response.status,
      statusText: response.statusText,
      rawText,
      errorMessage,
      errorBody,
      errorText: errorText || "(none)",
      details: errorBody?.details,
      code: errorBody?.code,
      hint: errorBody?.hint,
    });
    console.error("[API Client] =====================================");

    throw new Error(errorMessage);
  }

  return response.json();
};

export async function fetchConversations(limit = 50, offset = 0): Promise<ConversationResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return appFetch(`${APP_API_ROOT}?${params.toString()}`);
}

export async function createConversation(): Promise<{ session_id: string }> {
  return appFetch(APP_API_ROOT, { method: "POST" });
}

export async function deleteConversation(sessionId: string): Promise<{ deleted: boolean }> {
  return appFetch(`${APP_API_ROOT}/${sessionId}`, { method: "DELETE" });
}

export async function fetchConversationMessages(
  sessionId: string,
  limit = 50,
  offset = 0
): Promise<ConversationMessagesResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return appFetch(`${APP_API_ROOT}/${sessionId}/messages?${params.toString()}`);
}

export async function sendConversationMessage(
  sessionId: string,
  content: string
): Promise<ChatResponse> {
  return appFetch(`${APP_API_ROOT}/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchSessionContext(
  sessionId: string,
  supabaseToken: string,
  ttlSeconds = 600
): Promise<ConversationContextResponse> {
  const endpoint = getSupabaseFunctionUrl("conversation-cache");
  if (!endpoint) {
    throw new Error("Supabase URL not configured");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildSupabaseHeaders(supabaseToken),
    body: JSON.stringify({
      session_id: sessionId,
      ttl_seconds: ttlSeconds,
      include_summary: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Send a chat query to the RAG backend (RESTful)
 */
export async function sendChatMessage(
  query: string,
  sessionId?: string,
  userId?: string,
  supabaseToken?: string | null
): Promise<ChatResponse> {
  // STEP 1: Preprocess query (rate limiting + validation + enhancement)
  console.log('🔍 Preprocessing query...');

  let processedQuery = query;
  const preprocessUrl = getSupabaseFunctionUrl('query-preprocess');
  if (preprocessUrl) {
    try {
      if (!supabaseToken) {
        throw new Error('Authentication required for query preprocessing');
      }
      const preprocessResponse = await fetch(preprocessUrl, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseToken),
        body: JSON.stringify({
          query,
          user_id: userId,
          session_id: sessionId,
        }),
      });

      if (!preprocessResponse.ok) {
        const preprocessError = await preprocessResponse.json().catch(() => ({}));

        // Handle rate limiting with specific error
        if (preprocessResponse.status === 429) {
          throw new Error(`⏱️ ${preprocessError.reason || 'Rate limit exceeded. Please try again later.'}`);
        }

        // Handle other validation errors
        throw new Error(preprocessError.reason || 'Query validation failed');
      }

      const preprocessData = await preprocessResponse.json();

      if (!preprocessData.allowed) {
        throw new Error(preprocessData.reason || 'Query not allowed');
      }

      console.log('✅ Query preprocessing passed:', {
        enhanced: preprocessData.was_enhanced,
        remaining: preprocessData.rate_limit?.remaining,
      });

      // Use enhanced query (typos fixed, abbreviations expanded)
      processedQuery = preprocessData.enhanced_query || query;
    } catch (error) {
      console.warn('⚠️ Query preprocessing failed, continuing without enhancement:', error);
    }
  } else {
    console.warn('⚠️ Supabase URL not configured, skipping query preprocessing');
  }

  // STEP 2: Check search cache for existing answer
  console.log('🔍 Checking search cache...');

  const cacheUrl = getSupabaseFunctionUrl('search-cache');
  if (cacheUrl) {
    try {
      if (!supabaseToken) {
        throw new Error('Authentication required for cache lookup');
      }
      const cacheResponse = await fetch(cacheUrl, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseToken),
        body: JSON.stringify({
          query: processedQuery,
          user_id: userId,
          session_id: sessionId,
        }),
      });

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();

        // Cache HIT - return cached result immediately (10x faster!)
        if (cacheData.cached && cacheData.result) {
          console.log('✅ Cache HIT! Returning cached answer (hits:', cacheData.cache_metadata?.hit_count, ')');

          return {
            answer: cacheData.result.answer,
            citations: cacheData.result.citations || [],
            confidence: cacheData.result.confidence || 0,
            route: cacheData.result.route || 'answer',
            session_id: sessionId,
            timestamp: new Date().toISOString(),
          };
        }

        // Cache MISS - continue to RAG backend
        console.log('❌ Cache miss, calling RAG backend...');
      } else {
        console.warn('⚠️ Cache lookup failed, continuing to RAG backend');
      }
    } catch (error) {
      console.warn('⚠️ Cache lookup failed, continuing to RAG backend:', error);
    }
  } else {
    console.warn('⚠️ Supabase URL not configured, skipping cache lookup');
  }

  // STEP 3: Create session if not provided
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const sessionResponse = await fetch(`${API_ROOT}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      activeSessionId = sessionData.session_id;
    } else {
      // Fallback to random session ID
      activeSessionId = `session-${Date.now()}`;
    }
  }

  // STEP 4: Send message to RAG backend
  const response = await fetch(`${API_ROOT}/sessions/${activeSessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: processedQuery, // Use enhanced query
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const errorText = errorJson?.detail
      || errorJson?.error
      || (await response.text().catch(() => 'Unknown error'));
    throw new Error(errorText || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // Transform response to match expected format
  const ragResponse: ChatResponse = {
    answer: data.answer || data.content || 'No response',
    citations: data.citations || [],
    confidence: data.confidence || data.confidence_score || 0,
    route: data.route || 'answer',
    session_id: activeSessionId,
    timestamp: new Date().toISOString(),
  };

  // STEP 5: Store response in cache for future queries
  console.log('💾 Storing answer in cache...');

  try {
    const cacheUrl = getSupabaseFunctionUrl('search-cache');
    if (cacheUrl && supabaseToken) {
      await fetch(cacheUrl, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseToken),
        body: JSON.stringify({
          query: processedQuery,
          action: 'store',
          answer: ragResponse.answer,
          citations: ragResponse.citations,
          confidence: ragResponse.confidence,
          route: ragResponse.route,
          session_id: activeSessionId,
        }),
      });

      console.log('✅ Answer cached successfully');
    }
  } catch (cacheError) {
    // Don't fail the request if caching fails
    console.warn('⚠️ Failed to cache answer:', cacheError);
  }

  return ragResponse;
}

/**
 * Check the health status of the RAG backend
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_ROOT}/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
    models_loaded: data.models_loaded || false,
    vector_store_ready: data.vector_store_ready || false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Submit feedback for a chat message (RESTful)
 */
export async function submitFeedback(
  sessionId: string,
  messageId: string,
  helpful: boolean,
  comment?: string
): Promise<void> {
  const response = await fetch(
    `${API_ROOT}/sessions/${sessionId}/messages/${messageId}/feedback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        helpful,
        comment,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Feedback submission failed: ${response.status}`);
  }
}

/**
 * Load chat history for a session
 */
export async function loadChatHistory(
  sessionId: string,
  limit: number = 50,
  userId?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  if (userId) {
    params.append('user_id', userId);
  }

  const response = await fetch(
    `${API_ROOT}/sessions/${sessionId}/messages?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load chat history: ${response.status}`);
  }

  const data = await response.json();
  return data.messages || [];
}
