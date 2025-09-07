"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Bot, User, FileText, Brain, Search, Sparkles } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
}

interface KnowledgeSource {
  title: string
  content: string
  category: "medical" | "application" | "general"
  relevance?: number
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm MIDAS AI Assistant with advanced RAG capabilities. I can help you with medical questions, skin cancer information, and application guidance. What would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [retrievedSources, setRetrievedSources] = useState<KnowledgeSource[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          history: messages.slice(-5), // Send last 5 messages for context
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        sources: data.sources?.map((s: any) => s.title) || [],
      }

      setMessages((prev) => [...prev, assistantMessage])
      setRetrievedSources(data.sources || [])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const quickPrompts = [
    "What are the different types of skin cancer?",
    "How accurate is AI in detecting melanoma?",
    "What should I do if I find a suspicious mole?",
    "How to use the MIDAS analysis feature?",
    "What are the ABCDE signs of melanoma?",
    "How often should I check my skin?",
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">MIDAS AI Assistant</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advanced RAG-powered medical AI assistant with access to comprehensive skin cancer knowledge base
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              RAG Enabled
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" />
              Medical Knowledge Base
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              Real-time Retrieval
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Chat with MIDAS AI
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <Avatar className="h-8 w-8 bg-primary">
                            <AvatarFallback>
                              <Bot className="h-4 w-4 text-primary-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                              <div className="flex flex-wrap gap-1">
                                {message.sources.map((source, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{message.timestamp.toLocaleTimeString()}</p>
                        </div>

                        {message.role === "user" && (
                          <Avatar className="h-8 w-8 bg-accent">
                            <AvatarFallback>
                              <User className="h-4 w-4 text-accent-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <Avatar className="h-8 w-8 bg-primary">
                          <AvatarFallback>
                            <Bot className="h-4 w-4 text-primary-foreground animate-pulse" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                              <div
                                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              />
                              <div
                                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">Retrieving knowledge...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <div className="border-t p-4">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about skin cancer, medical questions, or app features..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Prompts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickPrompts.map((prompt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="w-full text-left justify-start min-h-[3rem] p-3 whitespace-normal leading-tight hover:bg-accent/50 transition-colors bg-transparent"
                    onClick={() => setInput(prompt)}
                    disabled={isLoading}
                  >
                    <span className="text-sm">{prompt}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Retrieved Sources */}
            {retrievedSources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Knowledge Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {retrievedSources.map((source, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{source.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {source.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{source.content}</p>
                      {source.relevance && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Relevance:</span>
                            <div className="flex-1 bg-background rounded-full h-1">
                              <div
                                className="bg-primary h-1 rounded-full"
                                style={{ width: `${source.relevance * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{Math.round(source.relevance * 100)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Brain className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-sm">RAG Technology</p>
                    <p className="text-xs text-muted-foreground">Retrieval-augmented responses</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Medical Knowledge</p>
                    <p className="text-xs text-muted-foreground">Comprehensive skin cancer database</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Smart Retrieval</p>
                    <p className="text-xs text-muted-foreground">Context-aware information finding</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
