"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatTimestamp } from "@/lib/utils/dateUtils"
import type { ConversationContextResponse } from "@/lib/api/chat"
import { IconX, IconBook, IconClock } from "@tabler/icons-react"

interface ContextPanelProps {
  open?: boolean
  loading?: boolean
  error?: string | null
  context?: ConversationContextResponse
  onClose: () => void
}

export function ContextPanel({
  open = true,
  loading,
  error,
  context,
  onClose,
}: ContextPanelProps) {
  if (!open) return null

  return (
    <aside className="flex h-full w-[320px] flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div>
          <p className="text-sm font-semibold">Context & Memory</p>
          <p className="text-xs text-muted-foreground">Recent conversation context</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {loading && (
          <div className="space-y-3">
            <div className="h-20 rounded-xl bg-muted/40" />
            <div className="h-24 rounded-xl bg-muted/40" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Context unavailable</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && context && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <IconBook className="h-4 w-4" />
                <span>Summary</span>
                {context.summary?.updated_at && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {formatRelativeTime(context.summary.updated_at)}
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-sm text-foreground">
                {context.summary?.summary ||
                  "No summary yet. The system will summarize once the conversation grows."}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <IconClock className="h-4 w-4" />
                Recent messages
              </div>
              {context.recent_messages?.length ? (
                <div className="space-y-3">
                  {context.recent_messages.map((message) => (
                    <div key={message.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{message.role}</span>
                        <span>{formatTimestamp(message.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent messages yet.</p>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {context?.expires_at && (
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Cache expires {formatRelativeTime(context.expires_at)}
        </div>
      )}
    </aside>
  )
}
