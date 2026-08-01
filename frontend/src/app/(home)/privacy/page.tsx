import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PageGrid = dynamic(() => import("@/components/effects/page-grid"));
const PrivacyContent = dynamic(() => import("@/comps/home/privacy-content"));

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MIDAS collects, uses and protects your medical and personal data — HIPAA compliance, data retention, third-party sharing and your privacy rights.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      <PageGrid />
      <PrivacyContent />
    </div>
  );
}
