import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ConversationSidebar } from "../ConversationSidebar"
import type { Conversation } from "@/types/chat"

describe("ConversationSidebar", () => {
  const mockConversations: Conversation[] = [
    {
      id: "conv-1",
      userId: "user-1",
      title: "Test Conversation 1",
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      messageCount: 5,
      metadata: {},
    },
    {
      id: "conv-2",
      userId: "user-1",
      title: "Test Conversation 2",
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
      messageCount: 3,
      metadata: {},
    },
  ]

  const mockHandlers = {
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onDelete: vi.fn(),
  }

  it("renders conversations list", () => {
    render(<ConversationSidebar conversations={mockConversations} {...mockHandlers} />)
    expect(screen.getByText("Test Conversation 1")).toBeInTheDocument()
    expect(screen.getByText("Test Conversation 2")).toBeInTheDocument()
  })

  it("filters conversations on search", async () => {
    render(<ConversationSidebar conversations={mockConversations} {...mockHandlers} />)
    const searchInput = screen.getByPlaceholderText("Search conversations")
    
    fireEvent.change(searchInput, { target: { value: "Conversation 1" } })
    
    await waitFor(() => {
      expect(screen.getByText("Test Conversation 1")).toBeInTheDocument()
      expect(screen.queryByText("Test Conversation 2")).not.toBeInTheDocument()
    }, { timeout: 500 })
  })

  it("calls onSelect when conversation is clicked", () => {
    render(<ConversationSidebar conversations={mockConversations} {...mockHandlers} />)
    const conversation = screen.getByText("Test Conversation 1")
    
    fireEvent.click(conversation)
    
    expect(mockHandlers.onSelect).toHaveBeenCalledWith("conv-1")
  })

  it("calls onNew when new conversation button is clicked", () => {
    render(<ConversationSidebar conversations={mockConversations} {...mockHandlers} />)
    const newButton = screen.getByRole("button", { name: /new/i })
    
    fireEvent.click(newButton)
    
    expect(mockHandlers.onNew).toHaveBeenCalled()
  })

  it("shows loading state", () => {
    render(<ConversationSidebar conversations={[]} loading {...mockHandlers} />)
    // Should show skeleton loaders
    expect(document.querySelectorAll(".h-16").length).toBeGreaterThan(0)
  })

  it("shows empty state when no conversations", () => {
    render(<ConversationSidebar conversations={[]} {...mockHandlers} />)
    expect(screen.getByText("No conversations found")).toBeInTheDocument()
  })
})
