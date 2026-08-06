import type { Metadata } from "next"
import dynamic from "next/dynamic"

const AnalysisConsole = dynamic(() => import("@/comps/dashboard/analysis/analysis-console"))

export const metadata: Metadata = {
  title: "AI Analysis",
  description: "Upload a dermoscopic image for AI-powered lesion analysis.",
}

/**
 * Server Component. Nothing is loaded on arrival — the console is upload-driven
 * and posts to /api/analysis/analyze, then calls router.refresh() so the history
 * and reports pages pick the new record up.
 */
export default function AnalysisPage() {
  return <AnalysisConsole />
}
