"use client"



import { useEffect, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { ChatArea } from "@/components/chat/ChatArea"
import { ContextPanel } from "@/components/chat/ContextPanel"
import { useChatStore } from "@/stores/chatStore"
import {
  useConversationMessages,
  useConversations,
  useCreateConversation,
  useSendMessage,
} from "@/hooks/useConversations"
import { useConversationContext } from "@/hooks/useConversationContext"
import { mapConversation } from "@/lib/api/chat"
import type { Message } from "@/types/chat"

const mapMessage = (message: any): Message => ({
  id: message.id,
  sessionId: message.session_id,
  role: message.role,
  content: message.content,
  createdAt: message.created_at,
  metadata: message.metadata,
})

export default function AssistantConsole() {
  const { user } = useUser()
  const hasUser = Boolean(user)
  const [draft, setDraft] = useState("")
  const [pendingMessages, setPendingMessages] = useState<Message[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  const {
    currentSessionId,
    setCurrentSession,
    contextPanelOpen,
    toggleContextPanel,
  } = useChatStore()

  const conversationsQuery = useConversations(!!user)
  const createConversationMutation = useCreateConversation()
  const sendMessageMutation = useSendMessage(currentSessionId)
  const messagesQuery = useConversationMessages(currentSessionId, 50, !!user)
  const contextQuery = useConversationContext(
    contextPanelOpen ? currentSessionId : null,
    !!user && contextPanelOpen
  )

  const conversations = useMemo(() => {
    return (conversationsQuery.data?.conversations || []).map(mapConversation)
  }, [conversationsQuery.data])

  const messages = useMemo(() => {
    return (messagesQuery.data?.messages || []).map(mapMessage)
  }, [messagesQuery.data])

  const visibleMessages = useMemo(() => {
    // Aggressive deduplication: use a Map keyed by ID for O(1) lookups
    const messageMap = new Map<string, Message>()
    
    // First, add all actual messages from the database
    for (const msg of messages) {
      messageMap.set(msg.id, msg)
    }
    
    // Only add pending messages that don't exist yet (not by ID or content)
    const actualContent = new Set(messages.map(m => 
      `${m.role}:${m.content.trim().toLowerCase()}`
    ))
    
    for (const pending of pendingMessages) {
      const contentKey = `${pending.role}:${pending.content.trim().toLowerCase()}`
      // Skip if ID already exists OR content already exists
      if (!messageMap.has(pending.id) && !actualContent.has(contentKey)) {
        messageMap.set(pending.id, pending)
      }
    }
    
    // Convert to array and sort by timestamp
    const dedupedMessages = Array.from(messageMap.values())
    return dedupedMessages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [messages, pendingMessages])

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === currentSessionId),
    [conversations, currentSessionId]
  )

  // Handle deleted/invalid session - redirect to valid session
  useEffect(() => {
    if (messagesQuery.error && currentSessionId) {
      const errorMsg = messagesQuery.error instanceof Error ? messagesQuery.error.message : ''
      if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
        console.log('[UI] Current session not found or deleted, switching to another')
        // Clear error and switch to another session
        setLocalError(null)
        const otherConversations = conversations.filter(c => c.id !== currentSessionId)
        if (otherConversations.length > 0) {
          setCurrentSession(otherConversations[0].id)
        } else {
          // No other conversations, create a new one
          if (!createConversationMutation.isPending) {
            createConversationMutation.mutateAsync()
              .then((result) => setCurrentSession(result.session_id))
              .catch(err => {
                console.error('[UI] Failed to create conversation:', err)
                setLocalError('Failed to create new conversation')
              })
          }
        }
      }
    }
    // Only run when error changes or sessionId changes
  }, [messagesQuery.error?.message, currentSessionId])

  useEffect(() => {
    if (bootstrapped || conversationsQuery.isLoading) return
    if (!hasUser) {
      setLocalError(null)
      return
    }

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
        .catch((error) => {
          console.error('[UI] Failed to create conversation:', error)
          const errorMsg = error instanceof Error ? error.message : 'Failed to create a new conversation.'
          setLocalError(errorMsg)
          setBootstrapped(true)
        })
    }
  }, [
    bootstrapped,
    hasUser,
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
      // Clear pending messages after successful send
      setPendingMessages(prev => prev.filter(p => p.id !== pendingMessage.id))
    } catch (error) {
      setDraft(message)
      setPendingMessages(prev => prev.filter(p => p.id !== pendingMessage.id))
      setLocalError(
        error instanceof Error
          ? error.message || "Failed to send message."
          : "Failed to send message."
      )
    }
  }

  const errorMessage =
    localError ||
    (messagesQuery.error instanceof Error ? messagesQuery.error.message : null) ||
    (sendMessageMutation.error instanceof Error ? sendMessageMutation.error.message : null)

  return (
    /* Two panes. The conversation list is no longer here — it hangs off the
       Assistant item in the app sidebar (`components/nav-conversations.tsx`),
       which reads the same query cache and the same `currentSessionId`. */
    <div className="flex h-full bg-background">
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
