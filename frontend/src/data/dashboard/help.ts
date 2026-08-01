import {
  IconBook,
  IconBrain,
  IconDownload,
  IconMail,
  IconMessageCircle,
  IconQuestionMark,
  IconRobot,
  IconScanEye,
  IconVideo,
} from "@tabler/icons-react";
import type { Faq, HelpAction, QuickHelpLink, ServiceStatus } from "@/types/dashboard";

export const QUICK_HELP: QuickHelpLink[] = [
  {
    icon: IconBrain,
    title: "Getting Started",
    description: "Learn the basics of MIDAS AI platform",
    link: "/docs/getting-started",
  },
  {
    icon: IconScanEye,
    title: "AI Analysis Guide",
    description: "How to perform skin lesion analysis",
    link: "/docs/analysis",
  },
  {
    icon: IconRobot,
    title: "AI Assistant Help",
    description: "Using the medical AI assistant",
    link: "/docs/assistant",
  },
  {
    icon: IconQuestionMark,
    title: "Account & Billing",
    description: "Manage your account and subscription",
    link: "/docs/account",
  },
];

export const FAQS: Faq[] = [
  {
    question: "How accurate is the AI diagnosis?",
    answer:
      "MIDAS AI achieves 99.2% clinical accuracy, matching or exceeding expert dermatologist performance in controlled studies.",
  },
  {
    question: "What types of skin lesions can MIDAS analyze?",
    answer:
      "MIDAS can analyze 8 different types of skin lesions including melanoma, basal cell carcinoma, squamous cell carcinoma, and various benign lesions.",
  },
  {
    question: "Is my medical data secure?",
    answer:
      "Yes, MIDAS is fully HIPAA compliant with end-to-end encryption and enterprise-grade security measures.",
  },
  {
    question: "Can I use MIDAS for multiple patients?",
    answer:
      "Yes, MIDAS supports multi-patient workflows with role-based access control and comprehensive audit trails.",
  },
  {
    question: "How long does analysis take?",
    answer:
      "Most analyses complete in under 2 minutes, with real-time progress updates and detailed reporting.",
  },
];

export const SUPPORT_CHANNELS: HelpAction[] = [
  { icon: IconMessageCircle, label: "Live Chat Support", badge: "Available 24/7" },
  { icon: IconMail, label: "Email Support", badge: "Response in 2-4 hours" },
  { icon: IconVideo, label: "Schedule Video Call", badge: "Enterprise only" },
];

export const HELP_RESOURCES: HelpAction[] = [
  { icon: IconBook, label: "Documentation", external: true },
  { icon: IconVideo, label: "Video Tutorials", external: true },
  { icon: IconDownload, label: "User Manual (PDF)", badge: "v2.1" },
];

export const SERVICE_STATUSES: ServiceStatus[] = [
  { service: "AI Analysis Engine", status: "operational", color: "text-green-600" },
  { service: "AI Assistant", status: "operational", color: "text-green-600" },
  { service: "Image Processing", status: "operational", color: "text-green-600" },
  { service: "Report Generation", status: "maintenance", color: "text-yellow-600" },
  { service: "Data Sync", status: "operational", color: "text-green-600" },
];
