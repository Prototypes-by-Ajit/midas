import { Brain, CheckCircle, FileText, Shield, Zap } from "lucide-react";
import type { ApiEndpoint, IconCard, QuickStartStep } from "@/types/home";

export const QUICK_START_STEPS: QuickStartStep[] = [
  {
    icon: CheckCircle,
    step: "Step 1",
    title: "Upload Medical Image",
    description:
      "Upload your dermoscopic images in supported formats (JPEG, PNG, DICOM)",
  },
  {
    icon: Brain,
    step: "Step 2",
    title: "AI Analysis",
    description:
      "Our advanced AI models analyze the image for potential skin cancer indicators",
  },
  {
    icon: FileText,
    step: "Step 3",
    title: "Get Results",
    description:
      "Receive detailed analysis results with confidence scores and recommendations",
  },
];

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/api/v1/analyze",
    title: "Image Analysis",
    description: "Submit medical images for AI-powered skin cancer analysis",
    parameters: "image (file), patient_id (optional)",
    response: "Analysis results with confidence scores",
  },
  {
    method: "GET",
    path: "/api/v1/results/{id}",
    title: "Retrieve Results",
    description: "Retrieve analysis results by result ID",
    parameters: "result_id (required)",
    response: "Complete analysis report",
  },
];

export const DOC_FEATURES: IconCard[] = [
  {
    icon: Brain,
    title: "Advanced AI Models",
    description:
      "Deep learning models trained on public dermoscopy datasets",
  },
  {
    icon: Shield,
    title: "HIPAA Compliant",
    description:
      "Enterprise-grade security with full HIPAA compliance and data encryption",
  },
  {
    icon: Zap,
    title: "Fast Results",
    description:
      "One request returns a classification, per-class probabilities and a Grad-CAM overlay",
  },
];
