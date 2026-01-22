"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChatInput } from "@/components/ai/chat-input"
import { PromptSuggestions } from "@/components/ai/prompt-suggestions"
import { Message } from "@/components/chat/Message"
import { cn } from "@/lib/utils"
import type { Message as ChatMessage } from "@/types/chat"
import {
  IconAlertCircle,
  IconBrain,
  IconLoader2,
  IconMenu2,
  IconPlus,
} from "@tabler/icons-react"

interface ChatAreaProps {
  title?: string
  subtitle?: string
  messages: ChatMessage[]
  isLoadingMessages?: boolean
  isSending?: boolean
  error?: string | null
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onNewConversation: () => void
  onToggleSidebar: () => void
  onToggleContext: () => void
  contextMessageCount?: number
  userImage?: string
}

export function ChatArea({
  title,
  subtitle,
  messages,
  isLoadingMessages,
  isSending,
  error,
  draft,
  onDraftChange,
  onSend,
  onNewConversation,
  onToggleSidebar,
  onToggleContext,
  contextMessageCount = 0,
  userImage,
}: ChatAreaProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isSending])

  return (
    <section className="flex h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">{title || "MIDAS Assistant"}</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {subtitle || "Multi-agent RAG with session memory"}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-8 w-8 sm:h-10 sm:w-10">
            <IconMenu2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleContext} className="h-8 w-8 sm:h-10 sm:w-10">
            <IconBrain className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onNewConversation} className="hidden sm:flex">
            <IconPlus className="h-4 w-4 mr-2" />
            New
          </Button>
          <Button size="icon" onClick={onNewConversation} className="h-8 w-8 sm:hidden">
            <IconPlus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {contextMessageCount > 0 && (
        <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:px-6">
          💡 Using context from {contextMessageCount} recent messages
        </div>
      )}

      {error && (
        <div className="px-3 pt-3 sm:px-6 sm:pt-4">
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <ScrollArea className="flex-1 px-3 py-4 sm:px-6 sm:py-6 chat-scrollbar">
        {isLoadingMessages ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center sm:p-6">
              <Badge variant="secondary" className="text-xs sm:text-sm">No messages yet</Badge>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                Start a new conversation or choose a prompt below.
              </p>
            </div>
            <PromptSuggestions onSelect={(prompt) => onDraftChange(prompt)} />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {messages.map((message) => (
              <Message key={message.id} message={message} userImage={userImage} className="message-slide-up" />
            ))}
            {isSending && (
              <div className={cn("flex items-center gap-2 text-xs text-muted-foreground sm:text-sm")}> 
                <IconLoader2 className="h-4 w-4 animate-spin" />
                MIDAS is thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border px-3 py-3 sm:px-6 sm:py-4">
        <ChatInput
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSend}
          disabled={isSending}
          placeholder="Ask anything about dermatology, lesions, or clinical workflows..."
          className="text-sm sm:text-base"
        />
      </div>
    </section>
  )
}
