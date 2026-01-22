"use client"

import { useRef, useEffect } from "react"
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type DynamicRowHeight,
  type RowComponentProps,
} from "react-window"
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
  const listRef = useListRef(null)
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: estimatedMessageHeight,
    key: messages.length,
  })

  type RowExtras = {
    messages: ChatMessage[]
    userImage?: string
    dynamicRowHeight: DynamicRowHeight
  }

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToRow({
        index: messages.length - 1,
        align: "end",
        behavior: "smooth",
      })
    }
  }, [messages.length, listRef])

  const Row = ({
    index,
    style,
    messages: rowMessages,
    userImage: rowUserImage,
    dynamicRowHeight,
  }: RowComponentProps<RowExtras> & RowExtras) => {
    const rowRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!rowRef.current) return undefined
      return dynamicRowHeight.observeRowElements([rowRef.current])
    }, [dynamicRowHeight, index])

    return (
      <div style={style} ref={rowRef}>
        <div className="px-4 py-2">
          <Message
            message={rowMessages[index]}
            userImage={rowUserImage}
            className="message-fade-in"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("chat-scrollbar", className)}>
      <List<RowExtras>
        listRef={listRef}
        defaultHeight={height}
        rowCount={messages.length}
        rowHeight={dynamicRowHeight}
        rowComponent={Row}
        rowProps={{ messages, userImage, dynamicRowHeight }}
        style={{ height, width: "100%" }}
        className="chat-scroll-smooth"
      />
    </div>
  )
}
