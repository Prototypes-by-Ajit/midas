import type { Metadata } from "next";
import dynamic from "next/dynamic";
const PageDots = dynamic(() => import("@/components/effects/page-dots"));
const ContactContent = dynamic(() => import("@/comps/home/contact-content"));

export const metadata: Metadata = {
  title: "Contact & Support",
  description:
    "Get help with MIDAS AI — email support, phone consultation, demo sessions and live chat, plus enterprise and research partnership enquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <PageDots />
      <ContactContent />
    </div>
  );
}
