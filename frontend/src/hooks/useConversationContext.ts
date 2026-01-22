import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@clerk/nextjs"
import { fetchSessionContext } from "@/lib/api/chat"

export const useConversationContext = (sessionId?: string | null) => {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: ["conversation-context", sessionId],
    queryFn: async () => {
      const token = await getToken({ template: "supabase" })
      if (!token) {
        throw new Error("Missing Supabase token")
      }
      return fetchSessionContext(sessionId as string, token)
    },
    enabled: Boolean(sessionId),
    staleTime: 2 * 60 * 1000,
  })
}
