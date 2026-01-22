"use client"

import { useState } from "react"
import { ConversationSidebar } from "./ConversationSidebar"
import { ChatArea } from "./ChatArea"
import { ContextPanel } from "./ContextPanel"
import { MobileSidebarOverlay } from "./MobileSidebarOverlay"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useConversationContext } from "@/hooks/useConversationContext"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/types/chat"

interface ChatLayoutProps {
  conversations: Conversation[]
  activeConversationId?: string | null
  messages: Message[]
  isLoadingConversations?: boolean
  isLoadingMessages?: boolean
  isSending?: boolean
  error?: string | null
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
  userImage?: string
  contextMessageCount?: number
}

export function ChatLayout({
  conversations,
  activeConversationId,
  messages,
  isLoadingConversations,
  isLoadingMessages,
  isSending,
  error,
  draft,
  onDraftChange,
  onSend,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  userImage,
  contextMessageCount,
}: ChatLayoutProps) {
  const isMobile = useIsMobile()
  
  // Mobile-first: Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)
  const [contextOpen, setContextOpen] = useState(false)

  // Fetch conversation context for the active conversation
  const { data: context, isLoading: isLoadingContext, error: contextError } = 
    useConversationContext(activeConversationId)

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
    // On mobile, close context panel when opening sidebar
    if (isMobile && !sidebarOpen) {
      setContextOpen(false)
    }
  }

  const handleToggleContext = () => {
    setContextOpen(!contextOpen)
    // On mobile, close sidebar when opening context
    if (isMobile && !contextOpen) {
      setSidebarOpen(false)
    }
  }

  const handleSelectConversation = (id: string) => {
    onSelectConversation(id)
    // Auto-close sidebar on mobile after selection
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleNewConversation = () => {
    onNewConversation()
    // Auto-close sidebar on mobile after creating
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Overlay */}
      <MobileSidebarOverlay
        isOpen={sidebarOpen && isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        loading={isLoadingConversations}
        open={sidebarOpen}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={onDeleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatArea
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          isSending={isSending}
          error={error}
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          onNewConversation={handleNewConversation}
          onToggleSidebar={handleToggleSidebar}
          onToggleContext={handleToggleContext}
          contextMessageCount={contextMessageCount}
          userImage={userImage}
        />
      </div>

      {/* Context Panel */}
      {contextOpen && (
        <div
          className={cn(
            "border-l border-border bg-background",
            "fixed right-0 top-0 z-40 h-full w-full sm:relative sm:z-auto sm:w-[320px] md:w-[360px]"
          )}
        >
          <ContextPanel
            open={contextOpen}
            loading={isLoadingContext}
            error={contextError?.message || null}
            context={context}
            onClose={() => setContextOpen(false)}
          />
        </div>
      )}

      {/* Context Panel Mobile Overlay */}
      {isMobile && contextOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={() => setContextOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
