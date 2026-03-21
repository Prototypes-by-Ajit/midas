"use client"

import { useState, useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  IconRobot,
  IconRefresh,
  IconDownload,
  IconSettings,
  IconAlertCircle
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AssistantMessage } from "@/components/ai/assistant-message"
import { UserMessage } from "@/components/ai/user-message"
import { PromptSuggestions } from "@/components/ai/prompt-suggestions"
import { ChatInput } from "@/components/ai/chat-input"
import { sendChatMessage, type Citation } from "@/lib/api/chat"
import { useAuth } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Citation[]
  confidence?: number
  route?: 'answer' | 'clarify' | 'refuse' | 'provider_error' | 'error'
}

export default function AIAssistantPageNew() {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState<string>(() => `session-${Date.now()}`)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      // Call the RESTful RAG backend API
      const supabaseToken = await getToken({ template: 'supabase' })
      if (!supabaseToken) {
        throw new Error('You must be signed in to chat.')
      }
      const response = await sendChatMessage(content.trim(), sessionId, undefined, supabaseToken)
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        citations: response.citations,
        confidence: response.confidence,
        route: response.route
      }
      
      setMessages(prev => [...prev, aiResponse])
    } catch (err) {
      console.error('Error calling RAG API:', err)
      setError(err instanceof Error ? err.message : 'Failed to get response')
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting to the backend service. Please make sure the backend is running and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptSelect = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    console.log(`Feedback for message ${messageId}: ${helpful ? 'helpful' : 'not helpful'}`)
    // TODO: Send feedback to backend via REST API
  }

  const handleNewChat = () => {
    setMessages([])
    setError(null)
  }

  const handleExportChat = () => {
    const chatText = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n')
    
    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `midas-chat-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-16 px-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <IconRobot className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                MIDAS AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground">Powered by Enhanced RAG</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online
            </Badge>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              disabled={messages.length === 0}
            >
              <IconRefresh className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportChat}
              disabled={messages.length === 0}
            >
              <IconDownload className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="icon">
              <IconSettings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-6 pt-4"
          >
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="container max-w-4xl mx-auto px-6 py-8">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12 space-y-4"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-30" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-primary-foreground font-bold text-sm">M</span>
                  </div>
                </div>
                
                <h2 className="text-3xl font-bold">Welcome to MIDAS AI</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Your intelligent medical AI companion specialized in skin cancer education. 
                  Ask me anything about melanoma, dermatology, or skin lesion detection.
                </p>
              </motion.div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {message.role === 'user' ? (
                      <UserMessage
                        content={message.content}
                        timestamp={message.timestamp}
                      />
                    ) : (
                      <AssistantMessage
                        content={message.content}
                        citations={message.citations}
                        confidence={message.confidence}
                        timestamp={message.timestamp}
                        isStreaming={false}
                        onFeedback={(helpful) => handleFeedback(message.id, helpful)}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Loading State */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <AssistantMessage
                    content="Thinking..."
                    isStreaming={true}
                  />
                </motion.div>
              )}

              {/* Prompt Suggestions (only show when empty) */}
              {messages.length === 0 && (
                <PromptSuggestions onSelect={handlePromptSelect} />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div className="container max-w-4xl mx-auto">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => handleSendMessage(inputValue)}
            disabled={isLoading}
            placeholder="Ask me anything about dermatology or skin cancer detection..."
          />

          {/* Footer Info */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
            <span>🔒 HIPAA Compliant</span>
            <span>🧠 AI-Powered RAG</span>
            <span>📚 Evidence-Based Responses</span>
          </div>
        </div>
      </div>
    </div>
  )
}
