import { useQuery } from "@tanstack/react-query"
import type { ConversationContextResponse } from "@/lib/api/chat"

export const useConversationContext = (sessionId?: string | null) => {
  return useQuery({
    queryKey: ["conversation-context", sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${sessionId}/context`, {
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch context: ${response.status}`)
      }
      
      return response.json() as Promise<ConversationContextResponse>
    },
    enabled: Boolean(sessionId),
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}
