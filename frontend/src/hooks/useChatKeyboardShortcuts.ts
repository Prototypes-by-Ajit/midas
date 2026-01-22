import { useEffect } from "react"

export interface ChatKeyboardShortcutHandlers {
  onSearch?: () => void // Ctrl+K
  onNewConversation?: () => void // Ctrl+N
  onSendMessage?: () => void // Ctrl+Enter
  onEscape?: () => void // Esc
}

export function useChatKeyboardShortcuts({
  onSearch,
  onNewConversation,
  onSendMessage,
  onEscape,
}: ChatKeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const modifier = isMac ? event.metaKey : event.ctrlKey

      // Ctrl/Cmd + K: Focus search
      if (modifier && event.key === "k") {
        event.preventDefault()
        onSearch?.()
        return
      }

      // Ctrl/Cmd + N: New conversation
      if (modifier && event.key === "n") {
        event.preventDefault()
        onNewConversation?.()
        return
      }

      // Ctrl/Cmd + Enter: Send message
      if (modifier && event.key === "Enter") {
        event.preventDefault()
        onSendMessage?.()
        return
      }

      // Escape: Close modals/clear focus
      if (event.key === "Escape") {
        event.preventDefault()
        onEscape?.()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSearch, onNewConversation, onSendMessage, onEscape])
}
