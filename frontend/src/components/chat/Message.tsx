"use client"

import { memo } from "react"
import { AssistantMessage } from "@/components/ai/assistant-message"
import { UserMessage } from "@/components/ai/user-message"
import { cn } from "@/lib/utils"
import type { Message as ChatMessage } from "@/types/chat"

interface MessageProps {
  message: ChatMessage
  userImage?: string
  className?: string
}

export const Message = memo(function Message({ message, userImage, className }: MessageProps) {
  const timestamp = message.createdAt ? new Date(message.createdAt) : undefined

  if (message.role === "assistant") {
    return (
      <AssistantMessage
        className={cn("w-full", className)}
        content={message.content}
        citations={message.metadata?.citations as any}
        confidence={message.metadata?.confidence}
        timestamp={timestamp}
      />
    )
  }

  if (message.role === "system") {
    return (
      <div className={cn("rounded-xl border border-border bg-muted/40 px-4 py-3", className)}>
        <p className="text-xs text-muted-foreground">System</p>
        <p className="text-sm text-foreground">{message.content}</p>
      </div>
    )
  }

  return (
    <UserMessage
      className={cn("w-full", className)}
      content={message.content}
      timestamp={timestamp}
      userImage={userImage}
    />
  )
})
