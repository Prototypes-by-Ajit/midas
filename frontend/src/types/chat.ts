export interface MessageMetadata {
  citations?: SourceDocument[]
  confidence?: number
  route?: "answer" | "clarify" | "refuse"
  latencyMs?: number
  modelUsed?: string
  [key: string]: unknown
}

export interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

export interface Conversation {
  id: string
  title?: string | null
  status?: string
  createdAt: string
  updatedAt?: string | null
  lastActivityAt?: string | null
  messageCount?: number
  metadata?: Record<string, unknown>
}

export interface ConversationSummary {
  sessionId: string
  summary: string
  messageCount?: number
  updatedAt?: string | null
}

export interface SourceDocument {
  id?: string
  source?: string
  content?: string
  relevance_score?: number
  metadata?: Record<string, unknown>
}
