"use client"

import { useRef, useEffect } from "react"
import { VariableSizeList as List } from "react-window"
import { Message } from "./Message"
import type { Message as ChatMessage } from "@/types/chat"
import { cn } from "@/lib/utils"

interface VirtualMessageListProps {
  messages: ChatMessage[]
  userImage?: string
  className?: string
  height?: number
  estimatedMessageHeight?: number
}

export function VirtualMessageList({
  messages,
  userImage,
  className,
  height = 600,
  estimatedMessageHeight = 100,
}: VirtualMessageListProps) {
  const listRef = useRef<List>(null)
  const rowHeights = useRef<Record<number, number>>({})

  const getRowHeight = (index: number) => {
    return rowHeights.current[index] || estimatedMessageHeight
  }

  const setRowHeight = (index: number, size: number) => {
    if (rowHeights.current[index] !== size) {
      rowHeights.current[index] = size
      listRef.current?.resetAfterIndex(index)
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, "end")
    }
  }, [messages.length])

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const rowRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (rowRef.current) {
        const height = rowRef.current.getBoundingClientRect().height
        setRowHeight(index, height)
      }
    }, [index])

    return (
      <div style={style} ref={rowRef}>
        <div className="px-4 py-2">
          <Message
            message={messages[index]}
            userImage={userImage}
            className="message-fade-in"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("chat-scrollbar", className)}>
      <List
        ref={listRef}
        height={height}
        itemCount={messages.length}
        itemSize={getRowHeight}
        width="100%"
        className="chat-scroll-smooth"
      >
        {Row}
      </List>
    </div>
  )
}
