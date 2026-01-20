"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth, useUser } from "@clerk/nextjs"
import {
  IconRobot,
  IconUser,
  IconSend,
  IconBrain,
  IconMicroscope,
  IconStethoscope,
  IconSparkles,
  IconLoader,
  IconAlertCircle
} from "@tabler/icons-react"
import { sendChatMessage, loadChatHistory, type Citation } from "@/lib/api/chat"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Citation[]
  confidence?: number
  route?: 'answer' | 'clarify' | 'refuse'
}

const SUGGESTED_PROMPTS = [
  "What are the key features to look for in melanoma detection?",
  "Explain the ABCDE rule for skin cancer screening",
  "How does AI improve dermatological diagnosis?",
  "What's the difference between benign and malignant lesions?"
]

// Get or create session ID from localStorage (user-specific)
const getSessionId = (userId: string | undefined): string => {
  if (typeof window === 'undefined' || !userId) return `session-${Date.now()}`

  // Use user-specific localStorage key
  const storageKey = `midas_session_${userId}`
  const stored = localStorage.getItem(storageKey)
  if (stored) return stored

  const newSessionId = `session-${userId}-${Date.now()}`
  localStorage.setItem(storageKey, newSessionId)
  return newSessionId
}

// Clean up old sessions when user changes
const cleanupOldSessions = (currentUserId: string | undefined) => {
  if (typeof window === 'undefined' || !currentUserId) return

  // Remove any session IDs that don't belong to current user
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith('midas_session_') && key !== `midas_session_${currentUserId}`) {
      localStorage.removeItem(key)
    }
  })

  // Also remove old non-user-specific session ID if it exists
  localStorage.removeItem('midas_session_id')
}

export default function AIAssistantPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize session ID when user is loaded
  useEffect(() => {
    if (user?.id) {
      // Clean up sessions from other users
      cleanupOldSessions(user.id)

      // Get or create session for this user
      const userSessionId = getSessionId(user.id)
      setSessionId(userSessionId)
    }
  }, [user?.id])

  // Load chat history on mount when session ID is ready
  useEffect(() => {
    if (!sessionId) return // Wait for session ID to be initialized

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true)
        const history = await loadChatHistory(sessionId, 50, user?.id)

        if (history.length > 0) {
          // Convert database messages to UI format
          const formattedMessages: Message[] = history.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
            citations: msg.citations,
            confidence: msg.confidence,
            route: msg.route
          }))
          setMessages(formattedMessages)
        } else {
          // No history, show welcome message
          setMessages([{
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m MIDAS AI Assistant, your medical AI companion specialized in skin cancer education. I can help answer questions about melanoma, basal cell carcinoma, squamous cell carcinoma, risk factors, prevention, and treatment concepts. How can I assist you today?',
            timestamp: new Date()
          }])
        }
      } catch (err) {
        console.error('Error loading chat history:', err)
        // Show welcome message on error
        setMessages([{
          id: '1',
          role: 'assistant',
          content: 'Hello! I\'m MIDAS AI Assistant, your medical AI companion specialized in skin cancer education. I can help answer questions about melanoma, basal cell carcinoma, squamous cell carcinoma, risk factors, prevention, and treatment concepts. How can I assist you today?',
          timestamp: new Date()
        }])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadHistory()
  }, [sessionId])

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
      // Call the real RAG backend API
      const supabaseToken = await getToken({ template: 'supabase' })
      if (!supabaseToken) {
        throw new Error('You must be signed in to chat.')
      }
      const response = await sendChatMessage(content.trim(), sessionId, user?.id, supabaseToken)
      
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
      
      // Fallback error message
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


  const handleSuggestedPrompt = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleNewConversation = () => {
    if (!user?.id) return

    // Generate new session ID for this user
    const newSessionId = `session-${user.id}-${Date.now()}`
    const storageKey = `midas_session_${user.id}`
    localStorage.setItem(storageKey, newSessionId)

    // Reload page to start fresh
    window.location.reload()
  }

  const formatMessageContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">M</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black dark:text-white">MIDAS AI Assistant</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Your medical AI companion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="text-sm"
            >
              New Conversation
            </Button>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Online
            </Badge>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Error Alert */}
        {error && (
          <div className="px-6 pt-4">
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Loading History Indicator */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8">
              <IconLoader className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading conversation history...</span>
            </div>
          )}

          {!isLoadingHistory && messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <span className="font-bold text-sm">M</span>
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'
                }`}
              >
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                />
                
                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-semibold mb-1">Sources:</p>
                    <div className="space-y-1">
                      {message.citations.map((citation, idx) => (
                        <div key={idx} className="text-xs opacity-80">
                          • {citation.source}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className={`text-xs mt-2 opacity-70 ${
                  message.role === 'user' ? 'text-primary-foreground/70' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {message.confidence && (
                    <span className="ml-2">
                      • Confidence: {(message.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700">
                    <IconUser className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <IconRobot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <IconLoader className="h-4 w-4 animate-spin" />
                  <span className="text-sm">MIDAS AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts (only show when no user messages) */}
        {messages.length === 1 && (
          <div className="flex-none px-6 pb-4">
            <div className="grid gap-2 md:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start text-left h-auto p-3 text-sm border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleSuggestedPrompt(prompt)}
                >
                  <IconSparkles className="h-4 w-4 mr-2 flex-shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-none border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage(inputValue)
            }}
            className="flex gap-3"
          >
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything about dermatology or skin cancer detection..."
                className="pr-12 border-gray-300 dark:border-gray-700"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-6"
            >
              <IconSend className="h-4 w-4" />
            </Button>
          </form>
          
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <IconMicroscope className="h-3 w-3" />
              <span>Dermatology Expert</span>
            </div>
            <div className="flex items-center gap-1">
              <IconBrain className="h-3 w-3" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-1">
              <IconStethoscope className="h-3 w-3" />
              <span>Medical Assistant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
