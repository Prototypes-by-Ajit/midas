import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PageGrid = dynamic(() => import("@/components/effects/page-grid"));
const ContactContent = dynamic(() => import("@/comps/home/contact-content"));

export const metadata: Metadata = {
  title: "Contact & Support",
  description:
    "Get help with MIDAS AI — email support, phone consultation, demo sessions and live chat, plus enterprise and research partnership enquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      <PageGrid />
      <ContactContent />
    </div>
  );
}
