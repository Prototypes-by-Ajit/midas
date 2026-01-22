import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Conversation, Message } from "@/types/chat"

interface ChatState {
  conversations: Conversation[]
  currentSessionId: string | null
  messages: Message[]
  loading: boolean
  error: string | null
  contextPanelOpen: boolean
  sidebarOpen: boolean
  loadConversations: (items: Conversation[]) => void
  loadConversation: (sessionId: string, items: Message[]) => void
  createNewConversation: (sessionId: string) => void
  deleteConversation: (sessionId: string) => void
  addMessage: (message: Message) => void
  setCurrentSession: (sessionId: string | null) => void
  toggleContextPanel: () => void
  toggleSidebar: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      currentSessionId: null,
      messages: [],
      loading: false,
      error: null,
      contextPanelOpen: true,
      sidebarOpen: true,
      loadConversations: (items) => set({ conversations: items }),
      loadConversation: (sessionId, items) =>
        set({ currentSessionId: sessionId, messages: items }),
      createNewConversation: (sessionId) =>
        set((state) => ({
          currentSessionId: sessionId,
          messages: [],
          conversations: [
            { id: sessionId, createdAt: new Date().toISOString() },
            ...state.conversations,
          ],
        })),
      deleteConversation: (sessionId) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== sessionId),
          messages: state.currentSessionId === sessionId ? [] : state.messages,
          currentSessionId:
            state.currentSessionId === sessionId ? null : state.currentSessionId,
        })),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
      toggleContextPanel: () =>
        set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: "midas-chat-ui",
      partialize: (state) => ({
        contextPanelOpen: state.contextPanelOpen,
        sidebarOpen: state.sidebarOpen,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
)
