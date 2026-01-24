"use client"

import { Button } from "@/components/ui/button"
import { IconSend, IconPaperclip, IconMicrophone } from "@tabler/icons-react"
import { useRef, useEffect, KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  className
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }, [value])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSubmit()
      }
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-end gap-5 p-2 rounded-2xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        {/* Optional: Attachment button */}
        {/* <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          disabled={disabled}
        >
          <IconPaperclip className="h-4 w-4" />
        </Button> */}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm focus:outline-none min-h-[36px] max-h-[200px] py-2 placeholder:text-muted-foreground disabled:opacity-50"
        />

        {/* Optional: Voice input button */}
        {/* <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          disabled={disabled}
        >
          <IconMicrophone className="h-4 w-4" />
        </Button> */}

        {/* Send button */}
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          disabled={!value.trim() || disabled}
          onClick={onSubmit}
        >
          <IconSend className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between px-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Enter</kbd> to send,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Shift + Enter</kbd> for new line
        </p>
        <p className="text-xs text-muted-foreground">
          {value.length} / 2000
        </p>
      </div>
    </div>
  )
}
