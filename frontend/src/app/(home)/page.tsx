import type { Metadata } from "next";
import dynamic from "next/dynamic";

const HeroSection = dynamic(() => import("@/comps/home/landing/hero-section"));
const ExperienceSection = dynamic(() => import("@/comps/home/landing/experience-section"));
const ProcessSection = dynamic(() => import("@/comps/home/landing/process-section"));
const FinalCtaSection = dynamic(() => import("@/comps/home/landing/final-cta-section"));

export const metadata: Metadata = {
  title: "AI-Powered Skin Cancer Detection",
  description:
    "MIDAS uses multimodal machine learning to deliver fast, accurate skin lesion classification for healthcare professionals.",
};

export default function HomePage() {
  return (
    <div className="bg-background relative overflow-hidden">
      <div className="absolute inset-0 w-full h-full -z-10 bg-gradient-to-br from-background via-background/95 to-background/90" />

      <div className="relative z-10">
        <HeroSection />
        <ExperienceSection />
        <ProcessSection />
        <FinalCtaSection />
      </div>
    </div>
  );
}
