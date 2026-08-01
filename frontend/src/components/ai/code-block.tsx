"use client"

import { Suspense, lazy } from "react"

const HighlightedCode = lazy(() => import("./highlighted-code"))

/**
 * Fenced code block in an assistant message.
 *
 * React.lazy + Suspense rather than next/dynamic on purpose: next/dynamic's
 * `loading` component receives no props, so it could not render the code while
 * the highlighter chunk loads. Here the fallback shows the real code with plain
 * styling and is swapped for the highlighted version once the chunk arrives —
 * same content, so no layout shift, and the code is readable throughout.
 */
export function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <Suspense fallback={<PlainCode code={code} />}>
      <HighlightedCode code={code} language={language} />
    </Suspense>
  )
}

function PlainCode({ code }: { code: string }) {
  return (
    <div className="rounded-lg bg-[#282c34] p-4 overflow-x-auto">
      <pre className="text-sm leading-[1.5] text-[#abb2bf]">
        <code>{code}</code>
      </pre>
    </div>
  )
}
