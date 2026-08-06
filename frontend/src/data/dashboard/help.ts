import {
  IconBook,
  IconFileText,
  IconLock,
  IconMail,
  IconReportMedical,
  IconRobot,
  IconScanEye,
  IconSparkles,
} from "@tabler/icons-react";
import type { Faq, HelpAction, QuickHelpLink } from "@/types/dashboard";

/**
 * Help page content.
 *
 * Two rules for this file:
 *
 * 1. Every `href` must be a route that exists. The previous version pointed at
 *    `/docs/getting-started`, `/docs/analysis`, `/docs/assistant` and
 *    `/docs/account` — none of which are routes — and the field was never even
 *    rendered, so the cards were unclickable.
 * 2. No capability or SLA we do not have. "Live Chat Support — Available 24/7",
 *    "Schedule Video Call — Enterprise only", "Response in 2-4 hours" and
 *    "User Manual (PDF) v2.1" were all invented; there is no chat widget, no
 *    call scheduling and no manual.
 */

export const QUICK_HELP: QuickHelpLink[] = [
  {
    icon: IconScanEye,
    title: "Analyse a lesion",
    description: "Upload a dermoscopic image and get a classification with a heatmap.",
    href: "/dashboard/analysis",
  },
  {
    icon: IconRobot,
    title: "Ask the assistant",
    description: "Put a dermatology question to the RAG assistant.",
    href: "/dashboard/assistant",
  },
  {
    icon: IconReportMedical,
    title: "Generate a report",
    description: "Turn a completed analysis into a patient or clinician PDF.",
    href: "/dashboard/reports",
  },
  {
    icon: IconBook,
    title: "Read the docs",
    description: "How the platform is put together and what it does.",
    href: "/docs",
  },
];

export const FAQS: Faq[] = [
  {
    category: "Using MIDAS",
    question: "How do I analyse a lesion?",
    answer:
      "Open Analysis, upload a dermoscopic image, and start the analysis. You get back a predicted lesion class, a confidence score, the full probability distribution across all 7 classes, and a Grad-CAM heatmap showing which parts of the image drove the prediction.",
  },
  {
    category: "Using MIDAS",
    question: "How do I generate a report?",
    answer:
      "From Reports, pick a completed analysis and choose a report type. Patient reports are written in plain language; clinician reports include the probability distribution and certainty metrics. Both are produced as PDFs you can download.",
  },
  {
    category: "Using MIDAS",
    question: "How long does an analysis take?",
    answer:
      "Analysis runs as a single request and reports its own processing time on the result. Report generation adds an LLM call on top of that, so it takes noticeably longer than the image analysis itself.",
  },
  {
    category: "Understanding results",
    question: "How accurate is the AI diagnosis?",
    answer:
      "MIDAS is a research prototype, not a diagnostic device, and its accuracy on live uploads has not been measured. The model was evaluated once on an internal validation split using patient metadata that the deployed service does not supply, so those figures do not describe what you see here. Treat every result as a second opinion for a clinician, never as a diagnosis.",
  },
  {
    category: "Understanding results",
    question: "What does the confidence score mean?",
    answer:
      "It is the model's probability for the class it picked — how much of its output distribution landed on that one label. It is not the probability that the prediction is correct, and it is not an accuracy figure. A high confidence score on a wrong prediction is entirely possible.",
  },
  {
    category: "Understanding results",
    question: "What does an \"Indeterminate\" risk level mean?",
    answer:
      "It means the probability distribution did not support any risk tier — no single class held more of the probability than all the others combined. Rather than guess a tier and attach follow-up advice to it, MIDAS says so explicitly. Treat indeterminate results as needing clinician review, never as low risk.",
  },
  {
    category: "Understanding results",
    question: "What is the heatmap showing me?",
    answer:
      "It is a Grad-CAM overlay: the image regions that most influenced the model's prediction. It is an explanation of where the model looked, not a lesion boundary, not a measurement, and not a segmentation of the lesion.",
  },
  {
    category: "Understanding results",
    question: "What types of skin lesions can MIDAS analyse?",
    answer:
      "MIDAS classifies 7 lesion types: actinic keratoses, basal cell carcinoma, benign keratosis-like lesions, dermatofibroma, melanoma, melanocytic nevi and vascular lesions. Anything outside those categories is still forced into one of them, which is one reason the confidence score and probability distribution matter.",
  },
  {
    category: "Data & access",
    question: "How is my data stored and who can see it?",
    answer:
      "Images and results are stored in a private Supabase project, encrypted in transit and at rest, and every query is scoped to the account that created the record. MIDAS has not been through any formal compliance certification, so please do not upload identifiable patient data to this prototype.",
  },
  {
    category: "Data & access",
    question: "Can I use MIDAS for multiple patients?",
    answer:
      "Analyses are tied to the account that ran them, and the platform has patient, clinician and admin roles that control which parts of the dashboard you can reach. There is no formal audit-log export, so it is not a substitute for a record-keeping system.",
  },
];

export const SUPPORT_CHANNELS: HelpAction[] = [
  {
    icon: IconMail,
    label: "Contact the team",
    description: "Send a question through the contact form",
    href: "/contact",
  },
];

export const HELP_RESOURCES: HelpAction[] = [
  {
    icon: IconBook,
    label: "Documentation",
    description: "Platform overview and guides",
    href: "/docs",
  },
  {
    icon: IconSparkles,
    label: "How MIDAS works",
    description: "Architecture, evaluation and limits",
    href: "/learn-more",
  },
  {
    icon: IconLock,
    label: "Privacy policy",
    description: "What is collected and why",
    href: "/privacy",
  },
  {
    icon: IconFileText,
    label: "Terms of service",
    href: "/terms",
  },
];
