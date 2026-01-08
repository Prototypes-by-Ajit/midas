"use client"

import { Button } from "@/components/ui/button"
import { IconSparkles, IconMicroscope, IconBrain, IconStethoscope, IconSearch } from "@tabler/icons-react"
import { motion } from "framer-motion"

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void
  className?: string
}

const SUGGESTIONS = [
  {
    icon: IconMicroscope,
    text: "What are the key features to look for in melanoma detection?",
    category: "Detection"
  },
  {
    icon: IconBrain,
    text: "Explain the ABCDE rule for skin cancer screening",
    category: "Education"
  },
  {
    icon: IconStethoscope,
    text: "How does AI improve dermatological diagnosis?",
    category: "Technology"
  },
  {
    icon: IconSearch,
    text: "What's the difference between benign and malignant lesions?",
    category: "Clinical"
  }
]

export function PromptSuggestions({ onSelect, className }: PromptSuggestionsProps) {
  return (
    <div className={className}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-3">
          <IconSparkles className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-muted-foreground">
            Suggested prompts to get started
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SUGGESTIONS.map((suggestion, index) => {
          const Icon = suggestion.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                variant="outline"
                className="h-auto p-4 flex-col items-start gap-2 hover:bg-accent hover:border-primary/50 transition-all group w-full"
                onClick={() => onSelect(suggestion.text)}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-colors">
                    <Icon className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {suggestion.category}
                  </span>
                </div>
                <p className="text-sm text-left text-foreground leading-relaxed">
                  {suggestion.text}
                </p>
              </Button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
