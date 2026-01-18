/**
 * API service for MIDAS RAG backend integration
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || 'http://localhost:8000';

const API_ROOT = API_BASE_URL.endsWith('/api/v1')
  ? API_BASE_URL
  : `${API_BASE_URL.replace(/\/$/, '')}/api/v1`;

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

/**
 * Send a chat query to the RAG backend (RESTful)
 */
export async function sendChatMessage(
  query: string,
  sessionId?: string,
  userId?: string
): Promise<ChatResponse> {
  // STEP 1: Preprocess query (rate limiting + validation + enhancement)
  console.log('🔍 Preprocessing query...');

  const preprocessResponse = await fetch(
    'https://mlacjzlhdmpufxqnmeze.supabase.co/functions/v1/query-preprocess',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        query,
        user_id: userId,
        session_id: sessionId,
      }),
    }
  );

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
  const processedQuery = preprocessData.enhanced_query || query;

  // STEP 2: Check search cache for existing answer
  console.log('🔍 Checking search cache...');

  const cacheResponse = await fetch(
    'https://mlacjzlhdmpufxqnmeze.supabase.co/functions/v1/search-cache',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        query: processedQuery,
        user_id: userId,
        session_id: sessionId,
      }),
    }
  );

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
    // Cache lookup failed, continue to RAG backend
    console.warn('⚠️ Cache lookup failed, continuing to RAG backend');
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
    await fetch(
      'https://mlacjzlhdmpufxqnmeze.supabase.co/functions/v1/search-cache',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          query: processedQuery,
          action: 'store',
          answer: ragResponse.answer,
          citations: ragResponse.citations,
          confidence: ragResponse.confidence,
          route: ragResponse.route,
          session_id: activeSessionId,
        }),
      }
    );

    console.log('✅ Answer cached successfully');
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
