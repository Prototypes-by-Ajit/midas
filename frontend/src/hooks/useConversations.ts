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
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId] })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}

export const useDeleteConversation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => deleteConversation(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
