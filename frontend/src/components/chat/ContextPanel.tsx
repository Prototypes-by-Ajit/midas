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
          <div className="rounded-xl border border-muted bg-muted/20 p-4">
            <p className="text-sm font-semibold">Context unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">
              Context caching is not configured. Your conversation history is still being saved.
            </p>
          </div>
        )}

        {!loading && !error && context && (
          <div className="space-y-6">
            {/* Conversation Summary */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <IconBook className="h-4 w-4" />
                <span>Conversation Summary</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {context.summary?.summary ||
                  "No summary yet. The system will summarize once the conversation grows."}
              </p>
            </div>

            {/* Key Topics */}
            {context.summary?.topics && context.summary.topics.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Key Topics
                </div>
                <div className="flex flex-wrap gap-2">
                  {context.summary.topics.map((topic: string, i: number) => (
                    <Badge key={i} variant="secondary" className="capitalize">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Query Patterns */}
            {context.summary?.query_patterns && context.summary.query_patterns.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Focus Areas
                </div>
                <div className="space-y-1">
                  {context.summary.query_patterns.map((pattern: string, i: number) => (
                    <div key={i} className="text-sm text-foreground capitalize">
                      • {pattern}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {context.metadata && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Conversation Stats
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Messages:</span>
                    <span className="font-medium">{context.metadata.total_messages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Questions Asked:</span>
                    <span className="font-medium">{context.metadata.user_questions}</span>
                  </div>
                  {context.metadata.avg_confidence_pct > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg. Confidence:</span>
                      <Badge 
                        variant={context.metadata.avg_confidence_pct >= 75 ? "default" : "secondary"}
                        className={context.metadata.avg_confidence_pct >= 75 ? "bg-green-600" : ""}
                      >
                        {context.metadata.avg_confidence_pct}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sources Used */}
            {context.summary?.sources_used && context.summary.sources_used.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Information Sources
                </div>
                <div className="space-y-1">
                  {context.summary.sources_used.map((source: string, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground truncate" title={source}>
                      • {source}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
