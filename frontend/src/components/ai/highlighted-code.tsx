"use client"

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism"

/**
 * Heavy leaf: Prism plus the full oneDark theme.
 *
 * Kept in its own module so it lands in a separate chunk — it is only reachable
 * through code-block.tsx's lazy boundary, which fires when an assistant message
 * actually contains a fenced code block. It used to be a static import in
 * assistant-message.tsx and therefore in the assistant route's main bundle.
 */
export default function HighlightedCode({
  code,
  language,
}: {
  code: string
  language: string
}) {
  return (
    <SyntaxHighlighter style={oneDark} language={language} PreTag="div" className="rounded-lg">
      {code}
    </SyntaxHighlighter>
  )
}
