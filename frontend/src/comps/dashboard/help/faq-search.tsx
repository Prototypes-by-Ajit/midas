"use client"

import { useMemo, useState } from "react"
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Faq, FaqCategory } from "@/types/dashboard"

/**
 * Searchable FAQ list.
 *
 * The only client component on the help page — it exists because the search box
 * needs state. Everything else on the route stays server-rendered.
 *
 * Disclosure uses native `<details>`/`<summary>` rather than a custom accordion:
 * the repo has no accordion primitive, and the native element already gives
 * keyboard operation, focus handling and correct semantics for nothing. All
 * answers render in the HTML, so browser find-in-page still reaches collapsed
 * text.
 */
export function FaqSearch({ faqs }: { faqs: Faq[] }) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? faqs.filter(
          (f) =>
            f.question.toLowerCase().includes(needle) ||
            f.answer.toLowerCase().includes(needle)
        )
      : faqs

    // Preserve the authored order of both categories and questions.
    const byCategory = new Map<FaqCategory, Faq[]>()
    for (const faq of matches) {
      const existing = byCategory.get(faq.category)
      if (existing) existing.push(faq)
      else byCategory.set(faq.category, [faq])
    }
    return [...byCategory.entries()]
  }, [faqs, query])

  const matchCount = groups.reduce((total, [, items]) => total + items.length, 0)
  const isSearching = query.trim().length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <IconSearch
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions and answers…"
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          >
            <IconX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Announced politely so the result count reaches screen readers as the
          list narrows, without interrupting typing. */}
      <p aria-live="polite" className="sr-only">
        {isSearching ? `${matchCount} matching questions` : `${faqs.length} questions`}
      </p>

      {matchCount === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No questions match “{query.trim()}”
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different word, or contact the team using the link in the sidebar.
          </p>
        </div>
      ) : (
        groups.map(([category, items]) => (
          <section key={category} aria-label={category} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            <div className="divide-y rounded-lg border">
              {items.map((faq) => (
                <details
                  key={faq.question}
                  // Auto-expand while searching so matches are readable
                  // without a second click, and collapse again when the query
                  // is cleared. React re-applies `open` whenever this value
                  // changes, which is exactly the transition we care about.
                  open={isSearching}
                  className="group px-4 [&[open]]:pb-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-4 text-sm font-medium text-foreground outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
                    <span>{faq.question}</span>
                    <IconChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>
                  <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
