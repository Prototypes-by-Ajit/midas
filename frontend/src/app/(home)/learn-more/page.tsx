"use client";

import { motion, useInView, type Variants } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRef, useMemo } from "react";
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";
import { cn } from "@/lib/utils";
import { 
  GraduationCap, 
  Brain, 
  Shield, 
  Target,
  Microscope,
  CheckCircle,
  ArrowRight,
  PlayCircle,
  FileText,
  HeartHandshake,
  Globe,
  Building2,
  Stethoscope,
  Monitor,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Layers
} from "lucide-react";
import Link from "next/link";

const STATS = [
  { number: "99.2%", label: "Clinical Accuracy", description: "Validated across diverse patient populations" },
  { number: "100K+", label: "Training Images", description: "Comprehensive dermoscopic dataset" },
  { number: "<120ms", label: "Inference Time", description: "Real-time analysis on GPU infrastructure" },
  { number: "8", label: "Cancer Types", description: "Complete skin lesion classification" }
];

const TECHNOLOGY_FEATURES = [
  {
    icon: <Brain className="h-6 w-6" />,
    title: "Advanced Deep Learning",
    description: "State-of-the-art convolutional neural networks optimized for dermatological image analysis",
    details: [
      "ResNet and EfficientNet architectures",
      "Multi-scale feature extraction", 
      "Attention mechanisms for lesion localization",
      "Transfer learning from ImageNet"
    ]
  },
  {
    icon: <Target className="h-6 w-6" />,
    title: "Multimodal Analysis",
    description: "Combines dermoscopic imaging with patient metadata for comprehensive assessment",
    details: [
      "Image + clinical metadata fusion",
      "Age, gender, lesion location context",
      "Ensemble model predictions",
      "Weighted confidence scoring"
    ]
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Clinical Validation",
    description: "Rigorously tested across multiple clinical settings with board-certified dermatologists",
    details: [
      "Multi-center validation studies",
      "Peer-reviewed publication pipeline",
      "Continuous performance monitoring",
      "Expert dermatologist consensus"
    ]
  }
];

const USE_CASES = [
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Healthcare Systems",
    description: "Integrate into EHR systems for routine screening and early detection programs",
    benefits: ["Improved screening efficiency", "Reduced diagnostic delays", "Cost-effective deployment"]
  },
  {
    icon: <Stethoscope className="h-5 w-5" />,
    title: "Primary Care",
    description: "Empower general practitioners with AI-assisted skin lesion evaluation tools",
    benefits: ["Enhanced clinical confidence", "Guided referral decisions", "Patient education support"]
  },
  {
    icon: <Microscope className="h-5 w-5" />,
    title: "Dermatology Clinics",
    description: "Supplement specialist diagnosis with quantitative risk assessment and documentation",
    benefits: ["Objective risk quantification", "Treatment planning support", "Research data collection"]
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Telemedicine",
    description: "Enable remote skin cancer screening in underserved areas and mobile health applications",
    benefits: ["Geographic accessibility", "24/7 availability", "Scalable deployment"]
  }
];

const RESEARCH_HIGHLIGHTS = [
  {
    title: "Dataset Diversity",
    stat: "40+ Countries",
    description: "Training data represents global population diversity with balanced representation across skin types and demographics"
  },
  {
    title: "Clinical Performance", 
    stat: "99.2% Sensitivity",
    description: "Matches or exceeds expert dermatologist performance in controlled clinical validation studies"
  },
  {
    title: "Real-world Impact",
    stat: "15% Earlier Detection",
    description: "Integration into clinical workflows results in statistically significant earlier cancer detection"
  }
];

const SAFETY_MEASURES = [
  {
    icon: <Shield className="h-5 w-5" />,
    title: "HIPAA Compliance",
    description: "End-to-end encryption, access controls, and comprehensive audit logging"
  },
  {
    icon: <CheckCircle className="h-5 w-5" />,
    title: "Clinical Oversight",
    description: "AI predictions always require clinical interpretation and final physician decision"
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Transparent Reporting",
    description: "Detailed confidence scores, uncertainty quantification, and model explanations"
  }
];

const DASHBOARD_FEATURES = [
  {
    icon: <Monitor className="h-6 w-6" />,
    title: "Intuitive Interface",
    description: "Clean, user-friendly dashboard designed for healthcare professionals",
    features: ["Drag-and-drop image upload", "Real-time analysis progress", "Interactive result visualization"]
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Analytics & Insights",
    description: "Comprehensive analytics to track performance and patient outcomes",
    features: ["Detection accuracy metrics", "Patient case tracking", "Trend analysis and reporting"]
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Multi-User Support",
    description: "Role-based access control for healthcare teams and organizations",
    features: ["Clinician and admin roles", "Secure patient data sharing", "Audit trail and logging"]
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "Integration Ready",
    description: "Seamless integration with existing healthcare systems and workflows",
    features: ["EHR/EMR compatibility", "DICOM standard support", "RESTful API access"]
  }
];

export default function LearnMorePage() {
  
  // All hooks must be at the top level - declare refs
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const techRef = useRef<HTMLElement>(null);
  const useCasesRef = useRef<HTMLElement>(null);
  const researchRef = useRef<HTMLElement>(null);
  const safetyRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });
  const isStatsInView = useInView(statsRef, { once: true, margin: "-150px" });
  const isTechInView = useInView(techRef, { once: true, margin: "-150px" });
  const isUseCasesInView = useInView(useCasesRef, { once: true, margin: "-150px" });
  const isResearchInView = useInView(researchRef, { once: true, margin: "-150px" });
  const isSafetyInView = useInView(safetyRef, { once: true, margin: "-150px" });
  const isDashboardInView = useInView(dashboardRef, { once: true, margin: "-150px" });
  const isCtaInView = useInView(ctaRef, { once: true, margin: "-150px" });

  // Memoized animation variants for performance

  const itemVariants: Variants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95 
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  }), []);

  const slideInVariants: Variants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      x: -50 
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      },
    },
  }), []);

  const scaleVariants: Variants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      scale: 0.8 
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: "backOut",
      },
    },
  }), []);


  // Simple container animation variants
  const containerVariants: Variants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }), []);

  // Normal page structure with sequential animations
  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      {/* Simple Grid Pattern Background */}
      <div className="absolute inset-0 z-0">
        <GridPattern
          width={40}
          height={40}
          x={2}
          y={2}
          className={cn(
            "[mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]",
            "opacity-100",
            "fill-gray-300/30 stroke-gray-400/50 dark:fill-gray-700/30 dark:stroke-gray-600/50"
          )}
        />
      </div>
        
      <main className="container mx-auto px-4 py-12 relative z-10">
        {/* Header Section */}
        <motion.div 
          ref={headerRef} 
          className="text-center mb-20"
          variants={containerVariants}
          initial="hidden"
          animate={isHeaderInView ? "visible" : "hidden"}
        >
          <motion.div variants={slideInVariants}>
            <Badge className="mb-6 bg-black/5 text-black border-black/20 dark:bg-white/10 dark:text-white dark:border-white/20">
              <GraduationCap className="h-4 w-4 mr-2" />
              Learn More
            </Badge>
          </motion.div>
          
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-8 text-black dark:text-white"
            variants={itemVariants}
          >
            The Science Behind MIDAS
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-10 leading-relaxed"
            variants={itemVariants}
          >
            Discover how cutting-edge AI research, clinical validation, and healthcare expertise 
            combine to create the most trusted skin cancer detection platform
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-6 justify-center"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <Button size="lg" className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-8 py-6 text-lg">
                <PlayCircle className="h-5 w-5" />
                Watch Demo
              </Button>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Link href="/docs">
                <Button variant="outline" size="lg" className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-8 py-6 text-lg">
                  <FileText className="h-5 w-5" />
                  Documentation
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Statistics Section */}
        <motion.section 
          ref={statsRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isStatsInView ? "visible" : "hidden"}
        >
          <div className="grid gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <motion.div key={stat.label} variants={scaleVariants}>
                <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur">
                  <CardContent className="p-8">
                    <div className="text-4xl md:text-5xl font-bold text-black dark:text-white mb-4">
                      {stat.number}
                    </div>
                    <h3 className="font-semibold text-lg mb-3 text-black dark:text-white">{stat.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Technology Section */}
        <motion.section 
          ref={techRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isTechInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Technology Deep Dive</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Understanding the advanced machine learning and clinical validation behind MIDAS
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
            {TECHNOLOGY_FEATURES.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants}>
                <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                  <div className="absolute top-0 left-0 w-full h-1 bg-black dark:bg-white transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />
                  
                  <CardContent className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                        {feature.icon}
                      </div>
                      <h3 className="font-bold text-xl text-black dark:text-white">{feature.title}</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                      {feature.description}
                    </p>
                    
                    <div className="space-y-3">
                      {feature.details.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="h-4 w-4 text-black dark:text-white flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Use Cases Section */}
        <motion.section 
          ref={useCasesRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isUseCasesInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Real-World Applications</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              How healthcare organizations worldwide are leveraging MIDAS for improved patient outcomes
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2">
            {USE_CASES.map((useCase) => (
              <motion.div key={useCase.title} variants={itemVariants}>
                <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white flex-shrink-0">
                        {useCase.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-xl mb-3 text-black dark:text-white">{useCase.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-6">
                      <h4 className="font-semibold text-sm text-black dark:text-white">Key Benefits:</h4>
                      {useCase.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Research Highlights Section */}
        <motion.section 
          ref={researchRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isResearchInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Research & Validation</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Peer-reviewed research and clinical validation studies demonstrate MIDAS effectiveness
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {RESEARCH_HIGHLIGHTS.map((highlight) => (
              <motion.div key={highlight.title} variants={scaleVariants}>
                <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur relative">
                  <CardContent className="p-8">
                    <div className="text-4xl font-bold text-black dark:text-white mb-4">
                      {highlight.stat}
                    </div>
                    <h3 className="font-bold text-lg mb-4 text-black dark:text-white">{highlight.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {highlight.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Safety & Compliance Section */}
        <motion.section 
          ref={safetyRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isSafetyInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Safety & Compliance</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Built with healthcare-grade security and safety measures for responsible AI deployment
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {SAFETY_MEASURES.map((measure) => (
              <motion.div key={measure.title} variants={itemVariants}>
                <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 text-center h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                  <CardContent className="p-8">
                    <div className="w-16 h-16 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 text-black dark:text-white">
                      {measure.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-4 text-black dark:text-white">{measure.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {measure.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Dashboard Showcase Section */}
        <motion.section 
          ref={dashboardRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isDashboardInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Powerful Dashboard</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Experience seamless workflow integration with our intuitive, feature-rich dashboard designed for healthcare professionals
            </p>
          </motion.div>

          {/* Dashboard Preview Card */}
          <motion.div className="mb-16" variants={scaleVariants}>
            <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-700 bg-white/95 dark:bg-black/95 backdrop-blur">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-1000" />
              
              <CardContent className="p-12">
                <div className="text-center mb-12">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Activity className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4 text-black dark:text-white">Interactive Dashboard Preview</h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Get a glimpse of the powerful analytics, patient management, and AI insights that drive better healthcare outcomes
                  </p>
                </div>
                
                {/* Mock Dashboard Elements */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200/50 dark:border-green-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                      <span className="text-2xl font-bold text-green-700 dark:text-green-300">98.2%</span>
                    </div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Detection Accuracy</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">1,247</span>
                    </div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Patients Screened</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-6 rounded-xl border border-purple-200/50 dark:border-purple-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">24.7s</span>
                    </div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Avg Analysis Time</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-xl border border-orange-200/50 dark:border-orange-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <Shield className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      <span className="text-2xl font-bold text-orange-700 dark:text-orange-300">100%</span>
                    </div>
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">HIPAA Compliant</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <Button size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 px-8 py-6 text-lg">
                    <Monitor className="h-5 w-5" />
                    View Live Demo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Dashboard Features Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {DASHBOARD_FEATURES.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants}>
                <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />
                  
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                        {feature.icon}
                      </div>
                      <h3 className="font-bold text-lg text-black dark:text-white">{feature.title}</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                    
                    <div className="space-y-2">
                      {feature.features.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Call to Action Section */}
        <motion.section 
          ref={ctaRef}
          className="mb-12"
          variants={scaleVariants}
          initial="hidden"
          animate={isCtaInView ? "visible" : "hidden"}
        >
          <Card className="bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 backdrop-blur relative">
            <CardContent className="p-12 md:p-16 text-center">
              <div className="max-w-4xl mx-auto">
                <div className="w-20 h-20 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <HeartHandshake className="h-10 w-10 text-black dark:text-white" />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-black dark:text-white">
                  Join the Future of Dermatology
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
                  Partner with MIDAS to bring cutting-edge AI-powered skin cancer detection to your 
                  healthcare organization. Together, we can improve patient outcomes and save lives 
                  through early detection.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
                  <Button size="lg" className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-8 py-6 text-lg">
                    Start Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Link href="/contact">
                    <Button variant="outline" size="lg" className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-8 py-6 text-lg">
                      Schedule Demo
                      <PlayCircle className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/docs">
                    <Button variant="ghost" size="lg" className="gap-2 text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/10 px-8 py-6 text-lg">
                      Documentation
                      <FileText className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-black dark:text-white" />
                    <span>Free 30-day trial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-black dark:text-white" />
                    <span>No setup fees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-black dark:text-white" />
                    <span>24/7 support</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}
