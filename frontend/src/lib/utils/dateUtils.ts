import { formatDistanceToNow } from "date-fns"
import type { Conversation } from "@/types/chat"

export const formatRelativeTime = (date: string | Date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export const formatTimestamp = (date: string | Date) => {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export const groupConversationsByTime = (conversations: Conversation[]) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 7)

  const buckets = {
    today: [] as Conversation[],
    yesterday: [] as Conversation[],
    thisWeek: [] as Conversation[],
    older: [] as Conversation[],
  }

  conversations.forEach((conversation) => {
    const date = new Date(conversation.lastActivityAt || conversation.createdAt)
    if (date >= startOfToday) {
      buckets.today.push(conversation)
    } else if (date >= startOfYesterday) {
      buckets.yesterday.push(conversation)
    } else if (date >= startOfWeek) {
      buckets.thisWeek.push(conversation)
    } else {
      buckets.older.push(conversation)
    }
  })

  return buckets
}
