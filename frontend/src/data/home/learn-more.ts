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
  Users,
} from "lucide-react";
import type { IconCard, IconCardWithItems, StatItem } from "@/types/home";

/**
 * Only facts that trace to the deployed checkpoint.
 *
 * The performance numbers that used to sit here — a clinical-accuracy
 * percentage, a training-image count and an inference time — matched no
 * evaluation run. What the checkpoint actually records lives in
 * `backend/models/midas_v1_final_best.metrics.json`,
 * and it is not publishable as a headline: it was measured with a patient
 * metadata vector that production replaces with zeros. Do not add a percentage
 * to this array — see that file's `caveats` and `excludedSources`.
 */
export const STATS: StatItem[] = [
  { number: "7", label: "Lesion classes", description: "AKIEC, BCC, BKL, DF, MEL, NV, VASC" },
  { number: "Grad-CAM", label: "Explainability", description: "Every prediction ships with an attention heatmap" },
  { number: "Research", label: "Prototype status", description: "Not a medical device, not for diagnostic use" },
];

export const TECHNOLOGY_FEATURES: IconCardWithItems[] = [
  {
    icon: Brain,
    title: "Advanced Deep Learning",
    description:
      "State-of-the-art convolutional neural networks optimized for dermatological image analysis",
    items: [
      "EfficientNet-B0 image encoder",
      "Transfer learning from ImageNet",
      "Grad-CAM attention heatmaps",
      "Per-class probability distribution on every prediction",
    ],
  },
  {
    icon: Target,
    title: "Architecture",
    description:
      "An image encoder fused with a metadata branch that inference does not currently supply",
    items: [
      "EfficientNet-B0 + 16-dim metadata encoder, concatenation fusion",
      "The metadata branch receives zeros at inference",
      "Single model, no ensembling",
      "Softmax confidence, top-2 margin and entropy reported per prediction",
    ],
  },
  {
    icon: Shield,
    title: "Evaluation",
    description:
      "Measured once on an internal split of a single public dataset. No clinical validation has been performed.",
    items: [
      "Public dermoscopy dataset, internal validation split",
      "No held-out test evaluation of the deployed checkpoint",
      "No multi-center or prospective study",
      "Not reviewed or cleared by any regulator",
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
