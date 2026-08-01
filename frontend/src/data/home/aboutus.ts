import type { GovernanceCard, TeamMember } from "@/types/home";

export const TEAM: TeamMember[] = [
  {
    name: "Ajitkumar Senthil Kumar",
    role: "ML Engineer and AI Developer • Data Science @ UB",
    bio: "Builds end-to-end MLOps: data pipelines, training, evaluation, and GPU inference services.",
    avatar: "/ajit.jpg",
    tags: [
      "MLOps",
      "PyTorch",
      "Multi-Agent RAG",
      "FastAPI",
      "System Design",
      "API sanitization",
      "Database Management",
    ],
    links: [
      { label: "Portfolio", href: "https://ajitkumar.io" },
      { label: "GitHub", href: "https://github.com/Ajitkumar-1001" },
    ],
  },
  {
    name: "Manoj Maheshwar Jagadeesan",
    role: "Project Manager and Product Designer• Artificial Intelligence @ UB",
    bio: "Focuses on multimodal modeling, attention mechanisms, and clinical evaluation workflows.",
    avatar: "/manoj.png",
    tags: [
      "Multimodal",
      "Attention",
      "Computer Vision",
      "Evaluation",
      "Product Design",
      "API design",
      "Bias Monitoring",
    ],
    links: [
      { label: "Portfolio", href: "https://manoj.ai/" },
      { label: "Github", href: "https://github.com/manojmaheshwarjg" },
    ],
  },
];

export const TECH: string[] = [
  "PyTorch",
  "timm",
  "Optuna",
  "FastAPI",
  "PostgreSQL",
  "Docker",
  "MLflow",
  "Weights & Biases",
  "Vercel/Render",
  "Tailwind",
  "shadcn/ui",
  "Next.js",
  "React",
  "TypeScript",
  "Supabase",
  "Clerk Auth",
  "Framer Motion",
  "LangChain",
  "OpenAI API",
  "Anthropic Claude",
  "Pinecone",
  "Node.js",
  "Lucide Icons",
];

export const GOVERNANCE_CARDS: GovernanceCard[] = [
  {
    emoji: "🔄",
    title: "Dataset Versioning",
    subtitle: "Complete Audit Trails",
    description:
      "Every dataset change is tracked with comprehensive versioning, experiment lineage, and full audit trails through MLflow integration.",
    features: ["Version Control", "Audit Trails", "MLflow Integration", "Data Lineage"],
  },
  {
    emoji: "⚖️",
    title: "Bias Monitoring",
    subtitle: "Fairness & Equality",
    description:
      "Continuous monitoring with calibration curves and comprehensive per-subgroup metrics to ensure equitable AI outcomes across all demographics.",
    features: ["Calibration Curves", "Fairness Metrics", "Subgroup Analysis", "Bias Detection"],
  },
  {
    emoji: "🔒",
    title: "Privacy Protection",
    subtitle: "Security First",
    description:
      "PHI-safe workflows with robust encryption, role-based access controls, and full compliance with healthcare regulations like HIPAA.",
    features: ["HIPAA Compliance", "Data Encryption", "Access Control", "Privacy by Design"],
  },
];
