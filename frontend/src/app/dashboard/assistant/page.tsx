"use client"

import { useEffect, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { ConversationSidebar } from "@/components/chat/ConversationSidebar"
import { ChatArea } from "@/components/chat/ChatArea"
import { ContextPanel } from "@/components/chat/ContextPanel"
import { useChatStore } from "@/stores/chatStore"
import {
  useConversationMessages,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useSendMessage,
} from "@/hooks/useConversations"
import { useConversationContext } from "@/hooks/useConversationContext"
import type { Conversation, Message } from "@/types/chat"

const mapConversation = (conversation: any): Conversation => ({
  id: conversation.id,
  title: conversation.title || conversation.metadata?.title,
  status: conversation.status,
  createdAt: conversation.created_at,
  updatedAt: conversation.updated_at,
  lastActivityAt: conversation.last_activity_at,
  messageCount: conversation.message_count,
  metadata: conversation.metadata,
})

const mapMessage = (message: any): Message => ({
  id: message.id,
  sessionId: message.session_id,
  role: message.role,
  content: message.content,
  createdAt: message.created_at,
  metadata: message.metadata,
})

export default function AIAssistantPage() {
  const { user } = useUser()
  const [draft, setDraft] = useState("")
  const [pendingMessages, setPendingMessages] = useState<Message[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  const {
    currentSessionId,
    setCurrentSession,
    sidebarOpen,
    contextPanelOpen,
    toggleSidebar,
    toggleContextPanel,
  } = useChatStore()

  const conversationsQuery = useConversations()
  const createConversationMutation = useCreateConversation()
  const deleteConversationMutation = useDeleteConversation()
  const sendMessageMutation = useSendMessage(currentSessionId)
  const messagesQuery = useConversationMessages(currentSessionId, 50)
  const contextQuery = useConversationContext(
    contextPanelOpen ? currentSessionId : null
  )

  const conversations = useMemo(() => {
    return (conversationsQuery.data?.conversations || []).map(mapConversation)
  }, [conversationsQuery.data])

  const messages = useMemo(() => {
    return (messagesQuery.data?.messages || []).map(mapMessage)
  }, [messagesQuery.data])

  const visibleMessages = useMemo(() => {
    if (pendingMessages.length === 0) return messages
    const merged = [...messages, ...pendingMessages]
    return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [messages, pendingMessages])

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === currentSessionId),
    [conversations, currentSessionId]
  )

  useEffect(() => {
    if (bootstrapped || conversationsQuery.isLoading) return

    if (currentSessionId) {
      const exists = conversations.some((conversation) => conversation.id === currentSessionId)
      if (exists) {
        setBootstrapped(true)
        return
      }
    }

    if (conversations.length > 0) {
      setCurrentSession(conversations[0].id)
      setBootstrapped(true)
      return
    }

    if (!createConversationMutation.isPending) {
      createConversationMutation
        .mutateAsync()
        .then((result) => {
          setCurrentSession(result.session_id)
          setBootstrapped(true)
        })
        .catch(() => {
          setLocalError("Failed to create a new conversation.")
          setBootstrapped(true)
        })
    }
  }, [
    bootstrapped,
    conversations,
    conversationsQuery.isLoading,
    createConversationMutation,
    currentSessionId,
    setCurrentSession,
  ])

  const handleCreateConversation = async () => {
    setLocalError(null)
    try {
      const result = await createConversationMutation.mutateAsync()
      setCurrentSession(result.session_id)
      setDraft("")
    } catch (error) {
      setLocalError("Failed to create a new conversation.")
    }
  }

  const handleDeleteConversation = async (sessionId: string) => {
    setLocalError(null)
    const remaining = conversations.filter((conversation) => conversation.id !== sessionId)

    try {
      await deleteConversationMutation.mutateAsync(sessionId)
      if (sessionId === currentSessionId) {
        if (remaining.length > 0) {
          setCurrentSession(remaining[0].id)
        } else {
          await handleCreateConversation()
        }
      }
    } catch (error) {
      setLocalError("Failed to delete conversation.")
    }
  }

  const handleSend = async () => {
    if (!draft.trim() || !currentSessionId) return

    setLocalError(null)
    const message = draft.trim()
    const pendingMessage: Message = {
      id: `pending-${Date.now()}`,
      sessionId: currentSessionId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
      metadata: {},
    }
    setDraft("")
    setPendingMessages((prev) => [...prev, pendingMessage])

    try {
      await sendMessageMutation.mutateAsync(message)
      setPendingMessages([])
    } catch (error) {
      setDraft(message)
      setPendingMessages([])
      setLocalError("Failed to send message.")
    }
  }

  const errorMessage =
    localError ||
    (messagesQuery.error instanceof Error ? messagesQuery.error.message : null) ||
    (sendMessageMutation.error instanceof Error ? sendMessageMutation.error.message : null)

  return (
    <div className="flex h-screen bg-background">
      <ConversationSidebar
        conversations={conversations}
        activeId={currentSessionId}
        loading={conversationsQuery.isLoading}
        open={sidebarOpen}
        onSelect={setCurrentSession}
        onNew={handleCreateConversation}
        onDelete={handleDeleteConversation}
      />

      <ChatArea
        title={activeConversation?.title ?? undefined}
        subtitle={
          activeConversation?.status
            ? `Status: ${activeConversation.status}`
            : "Session memory enabled"
        }
        messages={visibleMessages}
        isLoadingMessages={messagesQuery.isLoading}
        isSending={sendMessageMutation.isPending}
        error={errorMessage}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onNewConversation={handleCreateConversation}
        onToggleSidebar={toggleSidebar}
        onToggleContext={toggleContextPanel}
        contextMessageCount={contextQuery.data?.recent_messages?.length || 0}
        userImage={user?.imageUrl}
      />

      <ContextPanel
        open={contextPanelOpen}
        loading={contextQuery.isLoading}
        error={contextQuery.error instanceof Error ? contextQuery.error.message : null}
        context={contextQuery.data}
        onClose={toggleContextPanel}
      />
    </div>
  )
}
