"use client";

import { motion, useInView, type Variants } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRef, useMemo } from "react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/utils";
import { 
  Shield, 
  Eye, 
  Lock, 
  FileText, 
  Users, 
  Database, 
  Mail, 
  ArrowRight,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";

const PRIVACY_SECTIONS = [
  {
    icon: <Database className="h-6 w-6" />,
    title: "Information We Collect",
    description: "What information we gather and how we use it to provide our services",
    content: [
      "Medical images and associated metadata for AI analysis",
      "User account information (name, email, professional credentials)",
      "Usage analytics and system performance metrics",
      "Communication preferences and contact information"
    ]
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: "How We Use Your Information",
    description: "The purposes for which we process your personal and medical data",
    content: [
      "Provide AI-powered skin cancer detection analysis",
      "Improve our machine learning models and algorithms",
      "Communicate important updates and system notifications",
      "Ensure system security and prevent unauthorized access"
    ]
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Data Protection & Security",
    description: "Comprehensive measures to protect your sensitive medical information",
    content: [
      "End-to-end encryption for all medical data transmission",
      "HIPAA-compliant data storage and processing systems",
      "Regular security audits and vulnerability assessments",
      "Strict access controls and authentication protocols"
    ]
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Data Sharing & Third Parties",
    description: "When and how we may share your information with trusted partners",
    content: [
      "No sharing of medical data without explicit consent",
      "Anonymous, aggregated data for research purposes only",
      "Essential service providers under strict data agreements",
      "Legal compliance when required by law or regulation"
    ]
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Your Privacy Rights",
    description: "Your rights regarding your personal and medical information",
    content: [
      "Access and review all your stored data",
      "Request corrections to inaccurate information",
      "Delete your account and associated data",
      "Opt-out of non-essential communications"
    ]
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Data Retention",
    description: "How long we keep your information and why",
    content: [
      "Medical images retained for analysis accuracy improvement",
      "Account data maintained while service is active",
      "Audit logs kept for security and compliance purposes",
      "Automatic deletion options available upon request"
    ]
  }
];

const KEY_COMMITMENTS = [
  {
    title: "HIPAA Compliance",
    description: "Full adherence to healthcare privacy regulations"
  },
  {
    title: "Data Minimization",
    description: "We only collect data necessary for our services"
  },
  {
    title: "Transparent Processing",
    description: "Clear information about how we use your data"
  },
  {
    title: "User Control",
    description: "You maintain control over your information"
  }
];

export default function PrivacyPage() {
  // All hooks must be at the top level - declare refs
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLElement>(null);
  const commitmentsRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });
  const isSectionsInView = useInView(sectionsRef, { once: true, margin: "-150px" });
  const isCommitmentsInView = useInView(commitmentsRef, { once: true, margin: "-150px" });
  const isContactInView = useInView(contactRef, { once: true, margin: "-150px" });

  // Animation variants
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

  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0">
        <GridPattern
          width={40}
          height={40}
          x={-1}
          y={-1}
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
              <Shield className="h-4 w-4 mr-2" />
              Privacy Policy
            </Badge>
          </motion.div>
          
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-8 text-black dark:text-white"
            variants={itemVariants}
          >
            Your Privacy Matters
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-10 leading-relaxed"
            variants={itemVariants}
          >
            At MIDAS, we are committed to protecting your privacy and ensuring the security of your medical information. 
            This privacy policy explains how we collect, use, and protect your data.
          </motion.p>

          <motion.div variants={itemVariants}>
            <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-blue-900 dark:text-blue-100">Last Updated</span>
              </div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                This privacy policy was last updated on January 10, 2026. We may update this policy periodically to reflect changes in our practices or applicable laws.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Privacy Sections */}
        <motion.section 
          ref={sectionsRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isSectionsInView ? "visible" : "hidden"}
        >
          <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
            {PRIVACY_SECTIONS.map((section) => (
              <motion.div key={section.title} variants={itemVariants}>
                <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />
                  
                  <CardContent className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                        {section.icon}
                      </div>
                      <h3 className="font-bold text-xl text-black dark:text-white">{section.title}</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                      {section.description}
                    </p>
                    
                    <div className="space-y-3">
                      {section.content.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
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

        {/* Key Commitments */}
        <motion.section 
          ref={commitmentsRef}
          className="mb-24"
          variants={containerVariants}
          initial="hidden"
          animate={isCommitmentsInView ? "visible" : "hidden"}
        >
          <motion.div className="text-center mb-16" variants={slideInVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">Our Commitments</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Core principles that guide our approach to data privacy and protection
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {KEY_COMMITMENTS.map((commitment) => (
              <motion.div key={commitment.title} variants={scaleVariants}>
                <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur h-full">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-3 text-black dark:text-white">{commitment.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {commitment.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section 
          ref={contactRef}
          className="mb-12"
          variants={scaleVariants}
          initial="hidden"
          animate={isContactInView ? "visible" : "hidden"}
        >
          <Card className="bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 backdrop-blur">
            <CardContent className="p-12 md:p-16 text-center">
              <div className="max-w-4xl mx-auto">
                <div className="w-20 h-20 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Mail className="h-10 w-10 text-black dark:text-white" />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-black dark:text-white">
                  Questions About Privacy?
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
                  If you have any questions about this privacy policy or how we handle your data, 
                  our privacy team is here to help. Contact us for clarification or concerns.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <Button size="lg" className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-8 py-6 text-lg">
                    Contact Privacy Team
                    <Mail className="h-5 w-5" />
                  </Button>
                  <Link href="/terms">
                    <Button variant="outline" size="lg" className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-8 py-6 text-lg">
                      Terms & Conditions
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}