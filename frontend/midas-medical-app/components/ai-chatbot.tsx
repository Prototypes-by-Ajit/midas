"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  MessageCircle,
  Send,
  Bot,
  User,
  Minimize2,
  Maximize2,
  Sparkles,
  Heart,
  Brain,
  Stethoscope,
  BookOpen,
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface AIChatbotProps {
  userType: "patient" | "doctor"
  userName?: string
}

function useCustomChat(userType: string, userName: string) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        userType === "patient"
          ? `Hello ${userName}! 👋 I'm your MIDAS AI Assistant. I'm here to help you understand skin health, answer questions about dermatology, and guide you on when to seek professional care. How can I assist you today?`
          : `Welcome Dr. ${userName}! 🩺 I'm your MIDAS Clinical AI Assistant. I can help with clinical insights, differential diagnoses, treatment protocols, documentation, and case management. What would you like to discuss?`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userType,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""

      const assistantMessageId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.choices?.[0]?.delta?.content) {
                  assistantMessage += parsed.choices[0].delta.content
                  setMessages((prev) =>
                    prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: assistantMessage } : msg)),
                  )
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  }
}

export function AIChatbot({ userType, userName = "User" }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useCustomChat(userType, userName)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const quickPrompts =
    userType === "patient"
      ? [
          {
            icon: Heart,
            text: "What should I look for in a mole?",
            prompt: "What are the warning signs I should look for when examining moles on my skin?",
          },
          {
            icon: BookOpen,
            text: "Skin care routine",
            prompt: "Can you suggest a basic daily skin care routine for healthy skin?",
          },
          {
            icon: Sparkles,
            text: "When to see a doctor",
            prompt: "When should I see a dermatologist about a skin concern?",
          },
        ]
      : [
          {
            icon: Brain,
            text: "Differential diagnosis",
            prompt: "Help me think through differential diagnoses for a pigmented lesion with irregular borders",
          },
          {
            icon: Stethoscope,
            text: "Treatment protocols",
            prompt: "What are the current treatment protocols for early-stage melanoma?",
          },
          {
            icon: BookOpen,
            text: "Documentation help",
            prompt: "Help me document a skin cancer screening examination",
          },
        ]

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-2xl bg-primary hover:bg-primary/90 z-[9999] border-2 border-primary-foreground/20 animate-pulse hover:animate-none transition-all duration-300"
        size="icon"
      >
        <MessageCircle className="h-7 w-7 text-primary-foreground" />
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full flex items-center justify-center">
          <Bot className="h-2 w-2 text-accent-foreground" />
        </div>
      </Button>
    )
  }

  return (
    <Card
      className={`fixed bottom-4 right-4 z-[9999] shadow-2xl transition-all duration-300 border-2 ${
        isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
      }`}
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8 bg-primary">
              <AvatarFallback>
                <Bot className="h-4 w-4 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sm">MIDAS AI Assistant</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {userType === "patient" ? "Patient Support" : "Clinical Assistant"}
              </Badge>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(!isMinimized)}>
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              ×
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(600px-80px)]">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex items-start space-x-2 max-w-[80%] ${
                      message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={message.role === "user" ? "bg-primary" : "bg-accent"}>
                        {message.role === "user" ? (
                          <User className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Bot className="h-4 w-4 text-accent-foreground" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent">
                        <Bot className="h-4 w-4 text-accent-foreground animate-pulse" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Prompts */}
          <div className="p-3 border-t bg-muted/30">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 bg-transparent"
                  onClick={() => {
                    handleInputChange({ target: { value: prompt.prompt } } as any)
                  }}
                >
                  <prompt.icon className="h-3 w-3 mr-1" />
                  {prompt.text}
                </Button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={userType === "patient" ? "Ask about skin health..." : "Ask about clinical matters..."}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
