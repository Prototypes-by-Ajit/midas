"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconUser } from "@tabler/icons-react"

interface UserMessageProps {
  content: string
  timestamp?: Date
  userImage?: string
  className?: string
}

export function UserMessage({
  content,
  timestamp,
  userImage,
  className
}: UserMessageProps) {
  return (
    <div className={cn("flex gap-3 w-full justify-end", className)}>
      {/* Content */}
      <div className="flex-1 max-w-[80%] space-y-2 flex flex-col items-end">
        <div className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        
        {timestamp && (
          <span className="text-xs text-muted-foreground">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-8 w-8 border border-border shrink-0 mt-1">
        {userImage ? (
          <AvatarImage src={userImage} alt="User" />
        ) : (
          <AvatarFallback className="bg-muted">
            <IconUser className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>
    </div>
  )
}
