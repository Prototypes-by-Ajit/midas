import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PageGrid = dynamic(() => import("@/components/effects/page-grid"));
const HeaderSection = dynamic(() => import("@/comps/home/learn-more/header-section"));
const StatsSection = dynamic(() => import("@/comps/home/learn-more/stats-section"));
const TechnologySection = dynamic(() => import("@/comps/home/learn-more/technology-section"));
const UseCasesSection = dynamic(() => import("@/comps/home/learn-more/use-cases-section"));
const ResearchSection = dynamic(() => import("@/comps/home/learn-more/research-section"));
const SafetySection = dynamic(() => import("@/comps/home/learn-more/safety-section"));
const DashboardSection = dynamic(() => import("@/comps/home/learn-more/dashboard-section"));
const CtaSection = dynamic(() => import("@/comps/home/learn-more/cta-section"));

export const metadata: Metadata = {
  title: "The Science Behind MIDAS",
  description:
    "How MIDAS works — deep learning architecture, multimodal analysis, clinical validation, real-world use cases, research results and safety measures.",
};

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      <PageGrid x={2} y={2} />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12 relative z-10">
        <HeaderSection />
        <StatsSection />
        <TechnologySection />
        <UseCasesSection />
        <ResearchSection />
        <SafetySection />
        <DashboardSection />
        <CtaSection />
      </div>
    </div>
  );
}
