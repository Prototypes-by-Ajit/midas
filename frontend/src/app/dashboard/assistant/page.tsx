import type { Metadata } from "next"
import dynamic from "next/dynamic"

const AssistantConsole = dynamic(() => import("@/comps/dashboard/assistant/assistant-console"))

export const metadata: Metadata = {
  title: "AI Assistant",
  description: "Ask the multi-agent dermatology assistant about skin conditions.",
}

/**
 * Server Component.
 *
 * The console keeps its React Query + Zustand stack rather than being handed
 * server-fetched conversations: `useSendMessage` applies an optimistic update
 * that a HydrationBoundary would have to reconcile against, and a chat surface
 * is interaction-first, not load-first. Deliberately left client-owned.
 */
export default function AssistantPage() {
  return <AssistantConsole />
}
