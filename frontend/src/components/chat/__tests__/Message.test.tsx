import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Message } from "../Message"
import type { Message as ChatMessage } from "@/types/chat"

describe("Message", () => {
  it("renders user message", () => {
    const message: ChatMessage = {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello, this is a test message",
      createdAt: new Date().toISOString(),
    }

    render(<Message message={message} userImage="/avatar.jpg" />)
    expect(screen.getByText("Hello, this is a test message")).toBeInTheDocument()
  })

  it("renders assistant message", () => {
    const message: ChatMessage = {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content: "I am an assistant response",
      createdAt: new Date().toISOString(),
    }

    render(<Message message={message} />)
    expect(screen.getByText("I am an assistant response")).toBeInTheDocument()
  })

  it("renders system message", () => {
    const message: ChatMessage = {
      id: "msg-3",
      conversationId: "conv-1",
      role: "system",
      content: "System notification",
      createdAt: new Date().toISOString(),
    }

    render(<Message message={message} />)
    expect(screen.getByText("System")).toBeInTheDocument()
    expect(screen.getByText("System notification")).toBeInTheDocument()
  })

  it("displays metadata when available", () => {
    const message: ChatMessage = {
      id: "msg-4",
      conversationId: "conv-1",
      role: "assistant",
      content: "Message with metadata",
      createdAt: new Date().toISOString(),
      metadata: {
        confidence: 0.95,
        citations: ["source1", "source2"],
      },
    }

    render(<Message message={message} />)
    // Component should pass metadata to AssistantMessage
    expect(screen.getByText("Message with metadata")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const message: ChatMessage = {
      id: "msg-5",
      conversationId: "conv-1",
      role: "user",
      content: "Test",
      createdAt: new Date().toISOString(),
    }

    const { container } = render(<Message message={message} className="custom-class" />)
    expect(container.querySelector(".custom-class")).toBeInTheDocument()
  })
})
