"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime, groupConversationsByTime } from "@/lib/utils/dateUtils"
import { truncateText } from "@/lib/utils/textUtils"
import { useDebounce } from "@/hooks/useDebounce"
import type { Conversation } from "@/types/chat"
import { IconMessage, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react"

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeId?: string | null
  loading?: boolean
  open?: boolean
  onSelect: (sessionId: string) => void
  onNew: () => void
  onDelete: (sessionId: string) => void
}

const getConversationTitle = (conversation: Conversation, fallbackIndex: number) => {
  const metadataTitle = (conversation.metadata as Record<string, unknown> | undefined)?.title
  if (typeof conversation.title === "string" && conversation.title.trim()) {
    return conversation.title
  }
  if (typeof metadataTitle === "string" && metadataTitle.trim()) {
    return metadataTitle
  }
  return `Conversation ${fallbackIndex + 1}`
}

export function ConversationSidebar({
  conversations,
  activeId,
  loading,
  open = true,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return conversations
    const lowered = debouncedQuery.toLowerCase()
    return conversations.filter((conversation) => {
      const title = getConversationTitle(conversation, 0).toLowerCase()
      return title.includes(lowered)
    })
  }, [conversations, debouncedQuery])

  const grouped = useMemo(() => groupConversationsByTime(filtered), [filtered])

  const renderGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) return null
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="space-y-2">
          {items.map((conversation, index) => {
            const title = getConversationTitle(conversation, index)
            const messageCount = Number(
              conversation.messageCount ??
                (conversation.metadata as Record<string, unknown> | undefined)?.message_count ??
                0
            )
            const lastActivity = conversation.lastActivityAt || conversation.createdAt
            return (
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(conversation.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(conversation.id)
                  }
                }}
                className={cn(
                  "group w-full rounded-xl border border-border/60 p-2.5 text-left transition sm:p-3",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  activeId === conversation.id
                    ? "border-primary/50 bg-primary/10"
                    : "bg-background hover:border-primary/30 hover:bg-muted/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                      {truncateText(title, 36)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">
                      {formatRelativeTime(lastActivity)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {messageCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] sm:text-[10px]">
                        {messageCount}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition group-hover:opacity-100 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(conversation.id)
                      }}
                    >
                      <IconTrash className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-background transition-transform duration-300",
        "w-full sm:w-[280px] md:w-[320px]",
        "fixed inset-y-0 left-0 z-40 sm:relative sm:z-auto",
        !open && "hidden"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
            <IconMessage className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold sm:text-sm">Conversations</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Recent sessions</p>
          </div>
        </div>
        <Button size="icon" onClick={onNew} className="h-8 w-8 sm:h-10 sm:w-10">
          <IconPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-3 sm:px-4">
        <div className="relative">
          <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4 sm:px-4 sm:pb-6 chat-scrollbar">
        {loading ? (
          <div className="space-y-2 pt-2 sm:space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-xl border border-border/60 bg-muted/40 sm:h-16"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {renderGroup("Today", grouped.today)}
            {renderGroup("Yesterday", grouped.yesterday)}
            {renderGroup("This week", grouped.thisWeek)}
            {renderGroup("Older", grouped.older)}

            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center sm:p-6">
                <p className="text-xs font-medium text-foreground sm:text-sm">No conversations found</p>
                <p className="text-xs text-muted-foreground">Try a different search.</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
