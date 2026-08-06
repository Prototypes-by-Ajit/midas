import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PageGrid = dynamic(() => import("@/components/effects/page-grid"));
const DocsContent = dynamic(() => import("@/comps/home/docs-content"));

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Quick-start guide, API reference and feature overview for MIDAS AI skin cancer detection and medical image analysis.",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      <PageGrid />
      <DocsContent />
    </div>
  );
}
