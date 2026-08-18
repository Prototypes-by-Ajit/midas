/*** API service for MIDAS RAG backend integration**/

import type { Conversation } from '@/types/chat';

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
  /** null when no real score exists (e.g. the local demo fallback). */
  relevance_score: number | null;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  /**
   * null when the answer carries no measured confidence — the backend being
   * unavailable is the main case. Never coerce to 0: render nothing instead.
   */
  confidence: number | null;
  route: 'answer' | 'clarify' | 'refuse' | 'provider_error' | 'error';
  session_id?: string;
  timestamp: string;
  model_used?: string;
  mode?: string;
  confidence_breakdown?: Record<string, unknown>;
  details?: string;
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

/**
 * Snake-case API row -> camelCase domain type. Shared, because the assistant
 * console and the sidebar conversation tree read the same `["conversations"]`
 * cache and must agree on the title fallback and which timestamp is "latest".
 */
export function mapConversation(
  row: ConversationResponse["conversations"][number]
): Conversation {
  const metadataTitle = row.metadata?.title;
  return {
    id: row.id,
    title: row.title || (typeof metadataTitle === "string" ? metadataTitle : undefined),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at,
    messageCount: row.message_count,
    metadata: row.metadata,
  };
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
    avg_confidence?: number | null;
  } | null;
  metadata?: {
    total_messages: number;
    user_questions: number;
    /** null when no assistant message carried a real confidence. */
    avg_confidence_pct: number | null;
    assistant_responses?: number;
  } | null;
  expires_at: string;
}

const parseResponseBody = async (response: Response) => {
  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  const rawText = await response.text()

  if (!rawText) {
    return { payload: null, raw: rawText, contentType }
  }

  const normalizedRaw = rawText.trim()
  const looksLikeJson =
    normalizedRaw.startsWith("{") ||
    normalizedRaw.startsWith("[") ||
    normalizedRaw.toLowerCase().startsWith('"')

  if (
    contentType.includes("application/json") ||
    contentType.includes("text/json") ||
    looksLikeJson
  ) {
    try {
      return { payload: JSON.parse(rawText), raw: rawText, contentType }
    } catch (error) {
      console.error("[API Client] Failed to parse JSON response:", {
        path: response.url,
        error: error instanceof Error ? error.message : String(error),
        raw: rawText.substring(0, 500),
      })
      return { payload: rawText, raw: rawText, contentType, parseError: true }
    }
  }

  return { payload: rawText, raw: rawText, contentType }
}

const isNvidiaProviderLookupError = (message: string): boolean => {
  return /not found for account|function .*not found|error code:\s*404/i.test(message)
}

const buildProviderErrorPayload = (message: string, sessionId: string): ChatResponse => ({
  answer: [
    "I’m currently unable to generate a final answer because the configured NVIDIA provider function is unavailable.",
    "Please retry in a minute or contact the backend administrator to verify NVIDIA function configuration.",
    "If this continues, use a shorter, clearer clinical question.",
    "This is educational information only. Please consult a qualified dermatologist for diagnosis.",
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

const extractApiErrorMessage = (error: ApiClientError): string => {
  if (typeof error.payload === "string") return error.payload

  if (error.payload && typeof error.payload === "object") {
    const payload = error.payload as Record<string, unknown>

    const rootError = payload.error
    if (typeof rootError === "string") {
      const nested = rootError.replace(/^Backend error:\s*/, "")
      return nested
    }

    const detail = payload.detail
    if (typeof detail === "string") return detail

    if (typeof payload.message === "string") return payload.message
  }

  return error.message
}

export class ApiClientError extends Error {
  public status?: number
  public details?: string
  public payload?: Record<string, unknown> | string
  public path?: string

  constructor(
    message: string,
    options?: {
      status?: number
      details?: string
      payload?: Record<string, unknown> | string
      path?: string
    }
  ) {
    super(message)
    this.name = "ApiClientError"
    this.status = options?.status
    this.details = options?.details
    this.payload = options?.payload
    this.path = options?.path
  }
}

const API_FETCH_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_FETCH_TIMEOUT_MS) || 120000

const appFetch = async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const requestOptions: RequestInit = {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers,
  }

  const method = (requestOptions.method || "GET").toString().toUpperCase()
  let response: Response
  const startedAt = Date.now()

  try {
    console.log("[API Client] Making request:", {
      path,
      method,
      timeoutMs: API_FETCH_TIMEOUT_MS,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS)

    response = await fetch(path, {
      ...requestOptions,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    console.log("[API Client] Response received:", {
      path,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError"
    const message = isAbort
      ? `Request timed out after ${API_FETCH_TIMEOUT_MS}ms`
      : error instanceof Error
      ? error.message
      : "Network error"
    console.error("[API Client] Network error:", {
      path,
      method,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiClientError("Request timed out. Please try again.", {
        path,
        details: `Request timed out after ${API_FETCH_TIMEOUT_MS}ms`,
      })
    }
    throw new ApiClientError("Network error. Please check your connection.", {
      path,
      details: message,
    })
  }

  const { payload, raw } = await parseResponseBody(response)

  if (response.status === 204) {
    return {} as T
  }

  if (!response.ok) {
    const errorBody = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : null
    const errorMessage =
      (errorBody?.error as string | undefined)
      || (errorBody?.detail as string | undefined)
      || (errorBody?.message as string | undefined)
      || (typeof raw === "string" ? raw.trim() : "")
      || `HTTP ${response.status} ${response.statusText}`

    console.error("[API Client] ========== REQUEST FAILED ==========")
    console.error("[API Client] Path:", path)
    console.error("[API Client] Status:", response.status, response.statusText)
    console.error("[API Client] Error Body:", raw)
    console.error("[API Client] Error Parsed:", errorBody)
    console.error("[API Client] =====================================")

    const details =
      typeof raw === "string" ? raw.trim().slice(0, 2000) : JSON.stringify(errorBody)

    if (response.status === 401) {
      throw new ApiClientError("Unauthorized. Please sign in again.", {
        status: response.status,
        details,
        payload: errorBody || raw,
        path,
      })
    }

    const err = new ApiClientError(errorMessage, {
      status: response.status,
      details,
      payload: errorBody || raw,
      path,
    })

    throw err
  }

  return (payload as T) ?? ({} as T)
}

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
  try {
    return await appFetch(`${APP_API_ROOT}/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    })
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 500) {
      const message = extractApiErrorMessage(error)
      if (isNvidiaProviderLookupError(message)) {
        return buildProviderErrorPayload(message, sessionId)
      }
    }

    throw error
  }
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
            confidence: cacheData.result.confidence ?? null,
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

  // STEP 3: Create or reuse session
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const sessionResponse = await createConversation();
    activeSessionId = sessionResponse.session_id;
  }

  // STEP 4: Send message to RAG backend
  const data = await sendConversationMessage(activeSessionId, processedQuery);

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
        answer: data.answer,
        citations: data.citations,
        confidence: data.confidence,
        route: data.route,
        session_id: activeSessionId,
      }),
    });

      console.log('✅ Answer cached successfully');
    }
  } catch (cacheError) {
    // Don't fail the request if caching fails
    console.warn('⚠️ Failed to cache answer:', cacheError);
  }

  return {
    ...data,
    session_id: activeSessionId,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

/**
 * Check the health status of the RAG backend
 */
export async function checkHealth(): Promise<HealthResponse> {
  const candidates = [
    `${API_ROOT}/health`,
    `${API_ROOT}/healthz`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      return {
        status: data.status === 'healthy' ? 'healthy' : data.ready ? 'healthy' : 'unhealthy',
        models_loaded: data.models_loaded || data.models_ready || false,
        vector_store_ready: data.vector_store_ready || data.supabase_ready || false,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      // try next endpoint
    }
  }

  throw new Error(`Health check failed for all candidate endpoints`);
  
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
  limit: number = 50
): Promise<any[]> {
  const data = await fetchConversationMessages(sessionId, limit, 0);
  return data.messages || [];
}
