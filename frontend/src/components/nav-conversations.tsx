"use client"

import { useMemo, useState } from "react"
import { IconTrash } from "@tabler/icons-react"

import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  useConversations,
  useDeleteConversation,
} from "@/hooks/useConversations"
import { mapConversation } from "@/lib/api/chat"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils/dateUtils"
import { useChatStore } from "@/stores/chatStore"

/**
 * Conversation tree, nested under the Assistant item in the app sidebar.
 *
 * Self-contained by design: it reads the same `["conversations"]` React Query
 * cache and the same Zustand `currentSessionId` that `AssistantConsole` uses, so
 * nothing has to be lifted or drilled through the dashboard layout. Selecting a
 * row here re-renders the console because both subscribe to the same store.
 *
 * It deliberately does NOT bootstrap a conversation — `AssistantConsole` owns
 * that effect, and a second creator would race it into duplicate sessions.
 *
 * ponytail: renders every conversation the query returned (already capped at 50
 * server-side) and lets SidebarContent scroll. Add grouping or a cap when a real
 * user's list makes the rail unusable, not before.
 */
export function NavConversations() {
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { currentSessionId, setCurrentSession } = useChatStore()
  const conversationsQuery = useConversations()
  const deleteConversation = useDeleteConversation()

  const conversations = useMemo(
    () => (conversationsQuery.data?.conversations ?? []).map(mapConversation),
    [conversationsQuery.data]
  )

  const handleDelete = async (sessionId: string) => {
    setDeleteError(null)
    const remaining = conversations.filter((c) => c.id !== sessionId)
    try {
      await deleteConversation.mutateAsync(sessionId)
      // Switch off the dead session here rather than letting the console's
      // messages query 404 into its recovery path.
      if (sessionId === currentSessionId) {
        setCurrentSession(remaining[0]?.id ?? null)
      }
    } catch {
      setDeleteError("Couldn't delete that conversation.")
    }
  }

  if (conversationsQuery.isLoading) {
    return (
      <SidebarMenuSub>
        {Array.from({ length: 3 }).map((_, index) => (
          <SidebarMenuSubItem key={index}>
            <div className="h-7 animate-pulse rounded-md bg-sidebar-accent/60" />
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    )
  }

  if (conversations.length === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No conversations yet.
          </p>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    )
  }

  return (
    <SidebarMenuSub aria-label="Conversations">
      {conversations.map((conversation, index) => {
        const isActive = conversation.id === currentSessionId
        const title = conversation.title?.trim() || `Conversation ${index + 1}`
        const lastActivity = conversation.lastActivityAt || conversation.createdAt

        return (
          <SidebarMenuSubItem key={conversation.id} className="flex items-center">
            <SidebarMenuSubButton asChild size="sm" isActive={isActive} className="flex-1">
              <button
                type="button"
                onClick={() => setCurrentSession(conversation.id)}
                aria-current={isActive ? "true" : undefined}
                title={title}
              >
                <span className="min-w-0 flex-1 truncate text-left">{title}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatRelativeTime(lastActivity)}
                </span>
              </button>
            </SidebarMenuSubButton>
            <button
              type="button"
              aria-label={`Delete ${title}`}
              onClick={() => handleDelete(conversation.id)}
              disabled={deleteConversation.isPending}
              className={cn(
                "ml-0.5 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden",
                "group-hover/menu-sub-item:opacity-100 disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              <IconTrash className="size-3.5" />
            </button>
          </SidebarMenuSubItem>
        )
      })}

      {deleteError && (
        <SidebarMenuSubItem>
          <p role="status" className="px-2 py-1 text-xs text-destructive">
            {deleteError}
          </p>
        </SidebarMenuSubItem>
      )}
    </SidebarMenuSub>
  )
}
