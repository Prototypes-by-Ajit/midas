import { Ban, RefreshCw, Scale, Shield, UserCheck, Zap } from "lucide-react";
import type { IconCardWithItems, TitledNote } from "@/types/home";

export const TERMS_EFFECTIVE_DATE = "January 10, 2026";

export const TERMS_SECTIONS: IconCardWithItems[] = [
  {
    icon: UserCheck,
    title: "Acceptance & Eligibility",
    description: "Requirements for using MIDAS services and accepting these terms",
    items: [
      "Must be a licensed healthcare professional or authorized user",
      "Agreement to comply with applicable medical regulations",
      "Acceptance of terms constitutes a binding legal agreement",
      "Regular review of updated terms is required",
    ],
  },
  {
    icon: Zap,
    title: "Service Description",
    description: "What MIDAS provides and limitations of our AI analysis services",
    items: [
      "AI-powered skin lesion analysis for diagnostic assistance",
      "Educational resources and clinical decision support",
      "Integration capabilities with healthcare systems",
      "Service availability subject to technical maintenance",
    ],
  },
  {
    icon: Shield,
    title: "Medical Disclaimer",
    description: "Important limitations and medical responsibility requirements",
    items: [
      "AI analysis is for diagnostic assistance only, not replacement of clinical judgment",
      "Final diagnostic decisions must always be made by qualified healthcare providers",
      "Results should be considered alongside other clinical information",
      "MIDAS does not provide direct patient care or medical advice",
    ],
  },
  {
    icon: Scale,
    title: "User Responsibilities",
    description: "Your obligations when using MIDAS services",
    items: [
      "Maintain accuracy and completeness of submitted information",
      "Comply with all applicable healthcare regulations and standards",
      "Protect account credentials and prevent unauthorized access",
      "Report any security incidents or system issues promptly",
    ],
  },
  {
    icon: Ban,
    title: "Prohibited Uses",
    description: "Activities and uses that are not permitted with our services",
    items: [
      "Using the service for non-medical or unauthorized purposes",
      "Attempting to reverse engineer or replicate our AI models",
      "Sharing account access with unauthorized individuals",
      "Submitting false, misleading, or inappropriate content",
    ],
  },
  {
    icon: RefreshCw,
    title: "Service Modifications",
    description: "Our rights to modify, update, or discontinue services",
    items: [
      "Right to modify features and functionality with notice",
      "Regular updates to improve accuracy and performance",
      "Temporary service interruptions for maintenance",
      "Advance notice for significant changes when possible",
    ],
  },
];

export const LEGAL_HIGHLIGHTS: TitledNote[] = [
  {
    title: "Limitation of Liability",
    description: "Our liability is limited as permitted by applicable law",
  },
  {
    title: "No Medical Warranties",
    description: "AI analysis provided as-is without medical warranties",
  },
  {
    title: "Indemnification",
    description: "Users agree to indemnify MIDAS for authorized use",
  },
  {
    title: "Dispute Resolution",
    description: "Disputes resolved through binding arbitration",
  },
];
