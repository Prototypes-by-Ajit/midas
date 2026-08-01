import {
  Building2,
  Calendar,
  Clock,
  Laptop,
  Mail,
  MessageSquare,
  Phone,
  User,
  Users,
} from "lucide-react";
import type { ContactMethod, OutreachCard, SupportOption, TitledNote } from "@/types/home";

/** Response-time commitments in the page footer. */
export const RESPONSE_PROMISE: TitledNote[] = [
  { title: "Email Support", description: "Within 24 hours" },
  { title: "Phone Support", description: "Mon-Fri, 9AM-6PM EST" },
  { title: "Emergency Support", description: "24/7 for enterprise customers" },
];

export const SUPPORT_OPTIONS: SupportOption[] = [
  {
    icon: User,
    title: "View your account",
    description:
      "Sign in with your MIDAS Account for personalized support and to see your analysis history.",
    action: "Sign in",
    href: "/login",
  },
  {
    icon: Laptop,
    title: "See all services",
    description:
      "You can also get started by choosing a service and finding your specific needs.",
    action: "Choose a service",
    href: "/docs",
  },
  {
    icon: Clock,
    title: "View support activity",
    description:
      "View your recent or upcoming consultations, support tickets, and communications.",
    action: "View activity",
    href: "#",
  },
];

export const CONTACT_METHODS: ContactMethod[] = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Get help via email",
    detail: "Response within 24 hours",
    action: "Send Email",
    primary: true,
  },
  {
    icon: Phone,
    title: "Phone Consultation",
    description: "Speak with our team",
    detail: "Schedule a 30-min call",
    action: "Call Now",
    primary: false,
  },
  {
    icon: Calendar,
    title: "Demo Session",
    description: "See MIDAS AI in action",
    detail: "Live product demonstration",
    action: "Book Demo",
    primary: false,
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    description: "Chat with support team",
    detail: "Available Mon-Fri 9AM-6PM",
    action: "Start Chat",
    primary: false,
  },
];

/**
 * The two structurally identical outreach cards. The third card in this row
 * ("Watch Demo") stays hand-written JSX because its CTA is a DemoVideoTrigger,
 * not an inert button — array-driving it would need a discriminant field that
 * exists to serve one of three rows.
 */
export const OUTREACH_CARDS: OutreachCard[] = [
  {
    icon: Building2,
    title: "Enterprise Solutions",
    description:
      "Custom AI solutions for hospitals, clinics, and healthcare organizations. Get dedicated support and implementation assistance.",
    action: "Contact Enterprise Team",
  },
  {
    icon: Users,
    title: "Research Partnerships",
    description:
      "Collaborate with our research team on cutting-edge AI projects. Perfect for academic institutions and research organizations.",
    action: "Explore Partnerships",
  },
];
