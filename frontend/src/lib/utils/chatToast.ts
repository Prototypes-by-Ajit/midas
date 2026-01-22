import { toast } from "sonner"

export const chatToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: "bottom-right",
    })
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: "bottom-right",
    })
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: "bottom-right",
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: Error) => string)
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
      position: "bottom-right",
    })
  },

  conversationCreated: () => {
    chatToast.success("New conversation started")
  },

  conversationDeleted: () => {
    chatToast.success("Conversation deleted")
  },

  conversationError: () => {
    chatToast.error("Failed to load conversation")
  },

  messageError: () => {
    chatToast.error("Failed to send message")
  },

  copySuccess: () => {
    chatToast.success("Copied to clipboard")
  },

  networkError: () => {
    chatToast.error("Network error. Please check your connection.")
  },
}
