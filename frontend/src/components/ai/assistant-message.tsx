"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconRobot, IconCopy, IconCheck, IconThumbUp, IconThumbDown } from "@tabler/icons-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "@/components/ai/code-block"

export interface Citation {
  source: string
  chunk_id?: string
  relevance_score?: number
}

interface AssistantMessageProps {
  content: string
  citations?: Citation[]
  confidence?: number
  timestamp?: Date
  isStreaming?: boolean
  onFeedback?: (helpful: boolean) => void
  className?: string
}

export function AssistantMessage({
  content,
  citations,
  confidence,
  timestamp,
  isStreaming = false,
  onFeedback,
  className
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(helpful)
    onFeedback?.(helpful)
  }

  return (
    <div className={cn("group relative flex gap-3 w-full", className)}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 border border-border shrink-0 mt-1">
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <IconRobot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">MIDAS AI</span>
          {confidence && (
            <Badge variant="secondary" className="text-xs">
              {(confidence * 100).toFixed(0)}% confidence
            </Badge>
          )}
          {isStreaming && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span>Generating...</span>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <CodeBlock
                    code={String(children).replace(/\n$/, '')}
                    language={match[1]}
                  />
                ) : (
                  <code className={cn("bg-muted px-1 py-0.5 rounded text-sm", className)} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="border-l-2 border-primary/25 pl-3 py-2 bg-muted/30 rounded-r-md">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Sources</p>
            <div className="space-y-1">
              {citations.map((citation, idx) => (
                <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-mono">[{idx + 1}]</span>
                  <span className="flex-1">{citation.source}</span>
                  {citation.relevance_score && (
                    <Badge variant="outline" className="text-xs">
                      {(citation.relevance_score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <IconCheck className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <IconCopy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>

          {onFeedback && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs",
                  feedbackGiven === true && "text-success"
                )}
                onClick={() => handleFeedback(true)}
                disabled={feedbackGiven !== null}
              >
                <IconThumbUp className="h-3 w-3 mr-1" />
                Helpful
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs",
                  feedbackGiven === false && "text-critical"
                )}
                onClick={() => handleFeedback(false)}
                disabled={feedbackGiven !== null}
              >
                <IconThumbDown className="h-3 w-3 mr-1" />
                Not helpful
              </Button>
            </>
          )}

          {timestamp && (
            <span className="text-xs text-muted-foreground ml-auto">
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
