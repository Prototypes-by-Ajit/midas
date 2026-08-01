import type { Metadata } from "next";
import dynamic from "next/dynamic";
const DocsBackdrop = dynamic(() => import("@/components/effects/docs-backdrop"));
const DocsContent = dynamic(() => import("@/comps/home/docs-content"));


export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Quick-start guide, API reference and feature overview for MIDAS AI skin cancer detection and medical image analysis.",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <DocsBackdrop />
      <div className="relative z-10">
        <DocsContent />
      </div>
    </div>
  );
}
