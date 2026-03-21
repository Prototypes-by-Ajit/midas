import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ChatResponse,
  type ConversationMessagesResponse,
  createConversation,
  deleteConversation,
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from "@/lib/api/chat"

export const useConversations = (enabled = true) =>
  useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

export const useConversationMessages = (
  sessionId?: string | null,
  limit = 50,
  enabled = true
) =>
  useQuery({
    queryKey: ["messages", sessionId, limit],
    queryFn: () => fetchConversationMessages(sessionId as string, limit),
    enabled: enabled && Boolean(sessionId),
    refetchOnWindowFocus: false,  // Don't refetch on window focus
    refetchOnMount: false,         // Don't refetch on mount if data exists
    staleTime: 10 * 1000,          // Consider data fresh for 10 seconds
    retry: (failureCount, error) => {
      // Don't retry on 404 (conversation deleted)
      if (error instanceof Error && error.message.includes('not found')) {
        return false
      }
      return failureCount < 3
    },
  })

export const useCreateConversation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => createConversation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}

export const useSendMessage = (sessionId?: string | null) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      sendConversationMessage(sessionId as string, content),
    onSuccess: (response: ChatResponse) => {
      const activeSessionId = sessionId
      if (activeSessionId && response.answer?.trim()) {
        queryClient.setQueriesData<ConversationMessagesResponse>(
          { queryKey: ["messages", activeSessionId] },
          (current) => {
            if (!current) {
              return {
                session_id: activeSessionId,
                messages: [
                  {
                    id: `assistant-${Date.now()}`,
                    session_id: activeSessionId,
                    role: "assistant",
                    content: response.answer,
                    created_at: response.timestamp || new Date().toISOString(),
                    metadata: {
                      citations: response.citations,
                      confidence: response.confidence,
                      route: response.route,
                      modelUsed: response.model_used,
                      mode: response.mode,
                      confidence_breakdown: response.confidence_breakdown,
                      details: response.details,
                    },
                  },
                ],
                total: 1,
              }
            }

            const alreadyExists = current.messages.some(
              (message) =>
                message.role === "assistant" &&
                message.content.trim() === response.answer.trim()
            )

            if (alreadyExists) return current

            return {
              ...current,
              messages: [
                ...current.messages,
                {
                  id: `assistant-${Date.now()}`,
                  session_id: activeSessionId,
                  role: "assistant",
                  content: response.answer,
                  created_at: response.timestamp || new Date().toISOString(),
                  metadata: {
                    citations: response.citations,
                    confidence: response.confidence,
                    route: response.route,
                    modelUsed: response.model_used,
                    mode: response.mode,
                    confidence_breakdown: response.confidence_breakdown,
                    details: response.details,
                  },
                },
              ],
              total: current.total + 1,
            }
          }
        )
      }

      // Refetch afterwards to replace optimistic cache with persisted data.
      queryClient.invalidateQueries({
        queryKey: ["messages", sessionId],
        refetchType: "active",
      })
    },
  })
}

export const useDeleteConversation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => deleteConversation(sessionId),
    onSuccess: (_data, sessionId) => {
      // Remove this specific conversation's messages from cache
      queryClient.removeQueries({ queryKey: ["messages", sessionId] })
      // Invalidate conversations list to refetch
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
