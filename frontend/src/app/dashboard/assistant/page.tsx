"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  IconRobot,
  IconUser,
  IconSend,
  IconBrain,
  IconMicroscope,
  IconStethoscope,
  IconSparkles,
  IconLoader
} from "@tabler/icons-react"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  "What are the key features to look for in melanoma detection?",
  "Explain the ABCDE rule for skin cancer screening",
  "How does AI improve dermatological diagnosis?",
  "What's the difference between benign and malignant lesions?"
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m MIDAS AI Assistant, your medical AI companion for dermatology. I can help you with skin cancer detection, diagnosis explanations, and medical insights. How can I assist you today?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

    // Simulate AI response (replace with actual AI integration)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(content),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 1500)
  }

  const generateAIResponse = (userInput: string): string => {
    // Simple response generation (replace with actual AI integration)
    const input = userInput.toLowerCase()
    
    if (input.includes('melanoma') || input.includes('abcde')) {
      return 'The ABCDE rule is a helpful guide for identifying potential melanomas:\n\n**A** - Asymmetry: One half doesn\'t match the other\n**B** - Border: Irregular, scalloped, or poorly defined\n**C** - Color: Varied colors within the same mole\n**D** - Diameter: Larger than 6mm (pencil eraser size)\n**E** - Evolving: Changes in size, shape, color, or symptoms\n\nAlways consult a dermatologist for professional diagnosis.'
    }
    
    if (input.includes('ai') || input.includes('artificial intelligence')) {
      return 'AI enhances dermatological diagnosis through:\n\n• **Pattern Recognition**: Analyzing thousands of skin lesion images to identify subtle patterns\n• **Consistency**: Providing consistent analysis without fatigue\n• **Speed**: Rapid initial screening and triage\n• **Accuracy**: High sensitivity and specificity rates\n• **Accessibility**: Making expert-level analysis available globally\n\nMIDAS AI combines these capabilities to assist healthcare professionals in early skin cancer detection.'
    }
    
    if (input.includes('benign') || input.includes('malignant')) {
      return 'Key differences between benign and malignant lesions:\n\n**Benign Lesions:**\n• Well-defined borders\n• Uniform color and texture\n• Stable over time\n• Symmetrical appearance\n\n**Malignant Lesions:**\n• Irregular, ill-defined borders\n• Variable colors and textures\n• Changes over time\n• Asymmetrical appearance\n\nAI analysis helps identify these characteristics, but definitive diagnosis requires histopathological examination.'
    }
    
    return 'That\'s a great question about dermatology and skin cancer detection. MIDAS AI is designed to assist healthcare professionals with accurate, AI-powered analysis of skin lesions. For specific medical advice or diagnosis, please consult with a qualified dermatologist or healthcare provider. Is there a particular aspect of skin cancer detection or dermatology you\'d like to learn more about?'
  }

  const handleSuggestedPrompt = (prompt: string) => {
    handleSendMessage(prompt)
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
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <IconRobot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black dark:text-white">MIDAS AI Assistant</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Your medical AI companion</p>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            Online
          </Badge>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <IconRobot className="h-4 w-4" />
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
                <div className={`text-xs mt-2 opacity-70 ${
                  message.role === 'user' ? 'text-primary-foreground/70' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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