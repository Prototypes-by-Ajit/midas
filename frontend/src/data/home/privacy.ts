import { Database, Eye, FileText, Lock, Shield, Users } from "lucide-react";
import type { IconCardWithItems, TitledNote } from "@/types/home";

export const PRIVACY_LAST_UPDATED = "January 10, 2026";

export const PRIVACY_SECTIONS: IconCardWithItems[] = [
  {
    icon: Database,
    title: "Information We Collect",
    description: "What information we gather and how we use it to provide our services",
    items: [
      "Medical images and associated metadata for AI analysis",
      "User account information (name, email, professional credentials)",
      "Usage analytics and system performance metrics",
      "Communication preferences and contact information",
    ],
  },
  {
    icon: Lock,
    title: "How We Use Your Information",
    description: "The purposes for which we process your personal and medical data",
    items: [
      "Provide AI-powered skin cancer detection analysis",
      "Improve our machine learning models and algorithms",
      "Communicate important updates and system notifications",
      "Ensure system security and prevent unauthorized access",
    ],
  },
  {
    icon: Shield,
    title: "Data Protection & Security",
    description: "Comprehensive measures to protect your sensitive medical information",
    items: [
      "End-to-end encryption for all medical data transmission",
      "HIPAA-compliant data storage and processing systems",
      "Regular security audits and vulnerability assessments",
      "Strict access controls and authentication protocols",
    ],
  },
  {
    icon: Users,
    title: "Data Sharing & Third Parties",
    description: "When and how we may share your information with trusted partners",
    items: [
      "No sharing of medical data without explicit consent",
      "Anonymous, aggregated data for research purposes only",
      "Essential service providers under strict data agreements",
      "Legal compliance when required by law or regulation",
    ],
  },
  {
    icon: Eye,
    title: "Your Privacy Rights",
    description: "Your rights regarding your personal and medical information",
    items: [
      "Access and review all your stored data",
      "Request corrections to inaccurate information",
      "Delete your account and associated data",
      "Opt-out of non-essential communications",
    ],
  },
  {
    icon: FileText,
    title: "Data Retention",
    description: "How long we keep your information and why",
    items: [
      "Medical images retained for analysis accuracy improvement",
      "Account data maintained while service is active",
      "Audit logs kept for security and compliance purposes",
      "Automatic deletion options available upon request",
    ],
  },
];

export const KEY_COMMITMENTS: TitledNote[] = [
  {
    title: "HIPAA Compliance",
    description: "Full adherence to healthcare privacy regulations",
  },
  {
    title: "Data Minimization",
    description: "We only collect data necessary for our services",
  },
  {
    title: "Transparent Processing",
    description: "Clear information about how we use your data",
  },
  {
    title: "User Control",
    description: "You maintain control over your information",
  },
];
