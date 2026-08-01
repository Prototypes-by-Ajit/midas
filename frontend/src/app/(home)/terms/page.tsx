import type { Metadata } from "next";
import dynamic from "next/dynamic";
const PageGrid = dynamic(() => import("@/components/effects/page-grid"));
const TermsContent = dynamic(() => import("@/comps/home/terms-content"));



export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions governing use of MIDAS AI — eligibility, service description, medical disclaimer, user responsibilities and prohibited uses.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      <PageGrid />
      <TermsContent />
    </div>
  );
}
