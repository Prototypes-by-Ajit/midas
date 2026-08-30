import type { Metadata } from "next";
import dynamic from "next/dynamic";

const AboutUsContent = dynamic(() => import("@/comps/home/aboutus-content"));

export const metadata: Metadata = {
  title: "About Us",
  description:
    "The research-driven team behind MIDAS — our mission, engineering stack, and our approach to dataset versioning, bias monitoring and privacy protection.",
};

export default function AboutUsPage() {
  return (
    <div className="min-h-screen z-0">
      <AboutUsContent />
    </div>
  );
}