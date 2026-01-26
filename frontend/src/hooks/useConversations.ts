import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createConversation,
  deleteConversation,
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from "@/lib/api/chat"

export const useConversations = () =>
  useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(),
    staleTime: 5 * 60 * 1000,
  })

export const useConversationMessages = (sessionId?: string | null, limit = 50) =>
  useQuery({
    queryKey: ["messages", sessionId, limit],
    queryFn: () => fetchConversationMessages(sessionId as string, limit),
    enabled: Boolean(sessionId),
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
    onSuccess: () => {
      // Only invalidate messages query, not conversations
      // Use refetchType: 'none' to prevent automatic refetch
      queryClient.invalidateQueries({ 
        queryKey: ["messages", sessionId],
        refetchType: 'active'
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
