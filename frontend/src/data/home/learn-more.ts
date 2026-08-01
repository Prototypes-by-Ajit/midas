import {
  BarChart3,
  Brain,
  Building2,
  CheckCircle,
  FileText,
  Globe,
  Layers,
  Microscope,
  Monitor,
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  DashboardMetric,
  IconCard,
  IconCardWithItems,
  ResearchHighlight,
  StatItem,
} from "@/types/home";

export const STATS: StatItem[] = [
  { number: "89.0%", label: "Clinical Accuracy", description: "Validated across diverse patient populations" },
  { number: "100K+", label: "Training Images", description: "Comprehensive dermoscopic dataset" },
  { number: "<120ms", label: "Inference Time", description: "Real-time analysis on GPU infrastructure" },
  { number: "8", label: "Cancer Types", description: "Complete skin lesion classification" },
];

export const TECHNOLOGY_FEATURES: IconCardWithItems[] = [
  {
    icon: Brain,
    title: "Advanced Deep Learning",
    description:
      "State-of-the-art convolutional neural networks optimized for dermatological image analysis",
    items: [
      "ResNet and EfficientNet architectures",
      "Multi-scale feature extraction",
      "Attention mechanisms for lesion localization",
      "Transfer learning from ImageNet",
    ],
  },
  {
    icon: Target,
    title: "Multimodal Analysis",
    description:
      "Combines dermoscopic imaging with patient metadata for comprehensive assessment",
    items: [
      "Image + clinical metadata fusion",
      "Age, gender, lesion location context",
      "Ensemble model predictions",
      "Weighted confidence scoring",
    ],
  },
  {
    icon: Shield,
    title: "Clinical Validation",
    description:
      "Rigorously tested across multiple clinical settings with board-certified dermatologists",
    items: [
      "Multi-center validation studies",
      "Peer-reviewed publication pipeline",
      "Continuous performance monitoring",
      "Expert dermatologist consensus",
    ],
  },
];

export const USE_CASES: IconCardWithItems[] = [
  {
    icon: Building2,
    title: "Healthcare Systems",
    description:
      "Integrate into EHR systems for routine screening and early detection programs",
    items: [
      "Improved screening efficiency",
      "Reduced diagnostic delays",
      "Cost-effective deployment",
    ],
  },
  {
    icon: Stethoscope,
    title: "Primary Care",
    description:
      "Empower general practitioners with AI-assisted skin lesion evaluation tools",
    items: [
      "Enhanced clinical confidence",
      "Guided referral decisions",
      "Patient education support",
    ],
  },
  {
    icon: Microscope,
    title: "Dermatology Clinics",
    description:
      "Supplement specialist diagnosis with quantitative risk assessment and documentation",
    items: [
      "Objective risk quantification",
      "Treatment planning support",
      "Research data collection",
    ],
  },
  {
    icon: Globe,
    title: "Telemedicine",
    description:
      "Enable remote skin cancer screening in underserved areas and mobile health applications",
    items: ["Geographic accessibility", "24/7 availability", "Scalable deployment"],
  },
];

export const RESEARCH_HIGHLIGHTS: ResearchHighlight[] = [
  {
    title: "Dataset Diversity",
    stat: "40+ Countries",
    description:
      "Training data represents global population diversity with balanced representation across skin types and demographics",
  },
  {
    title: "Clinical Performance",
    stat: "89.0% Sensitivity",
    description:
      "Matches or exceeds expert dermatologist performance in controlled clinical validation studies",
  },
  {
    title: "Real-world Impact",
    stat: "15% Earlier Detection",
    description:
      "Integration into clinical workflows results in statistically significant earlier cancer detection",
  },
];

export const SAFETY_MEASURES: IconCard[] = [
  {
    icon: Shield,
    title: "HIPAA Compliance",
    description: "End-to-end encryption, access controls, and comprehensive audit logging",
  },
  {
    icon: CheckCircle,
    title: "Clinical Oversight",
    description:
      "AI predictions always require clinical interpretation and final physician decision",
  },
  {
    icon: FileText,
    title: "Transparent Reporting",
    description:
      "Detailed confidence scores, uncertainty quantification, and model explanations",
  },
];

export const DASHBOARD_FEATURES: IconCardWithItems[] = [
  {
    icon: Monitor,
    title: "Intuitive Interface",
    description: "Clean, user-friendly dashboard designed for healthcare professionals",
    items: [
      "Drag-and-drop image upload",
      "Real-time analysis progress",
      "Interactive result visualization",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Comprehensive analytics to track performance and patient outcomes",
    items: [
      "Detection accuracy metrics",
      "Patient case tracking",
      "Trend analysis and reporting",
    ],
  },
  {
    icon: Users,
    title: "Multi-User Support",
    description: "Role-based access control for healthcare teams and organizations",
    items: [
      "Clinician and admin roles",
      "Secure patient data sharing",
      "Audit trail and logging",
    ],
  },
  {
    icon: Layers,
    title: "Integration Ready",
    description: "Seamless integration with existing healthcare systems and workflows",
    items: ["EHR/EMR compatibility", "DICOM standard support", "RESTful API access"],
  },
];

/** Tiles in the mock dashboard preview. Was four copy-pasted <div> blocks. */
export const DASHBOARD_METRICS: DashboardMetric[] = [
  { icon: TrendingUp, value: "98.2%", label: "Detection Accuracy" },
  { icon: Users, value: "1,247", label: "Patients Screened" },
  { icon: BarChart3, value: "24.7s", label: "Avg Analysis Time" },
  { icon: Shield, value: "100%", label: "HIPAA Compliant" },
];
