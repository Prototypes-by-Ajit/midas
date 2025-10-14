'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BackgroundGradient } from '@/components/ui/background-gradient';

import {
  BookOpen,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle,
  Brain,
  Lightbulb,
  FileText,
  Terminal,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const DotPattern = dynamic(() => import("@/components/ui/dot-pattern").then((mod) => ({ default: mod.DotPattern })),
{ 
  ssr: false,
  loading: () => null // Optional: loading component
}
);
const DocsPage = () => {
  // Refs for sections
  const heroRef = useRef<HTMLDivElement>(null);
  const quickStartRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // useInView hooks
  const isHeroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const isQuickStartInView = useInView(quickStartRef, { once: true, margin: "-150px" });
  const isApiInView = useInView(apiRef, { once: true, margin: "-150px" });
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: "-150px" });
  const isCtaInView = useInView(ctaRef, { once: true, margin: "-150px" });

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Animated Dot Pattern Background with Glow Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient overlay for subtle depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        {/* Main dot pattern with glow */}
        <DotPattern
          width={32}
          height={32}
          cx={3}
          cy={2}
          cr={3}
          glow={true}
          className={cn(
            "opacity-50 dark:opacity-40 text-primary/60 dark:text-primary/40"
          )}
        />
        
        {/* Secondary smaller dots for depth */}
        <DotPattern
          width={16}
          height={16}
          cx={0.2}
          cy={0.2}
          cr={0.5}
          glow={true}
          className={cn(
            "opacity-20 dark:opacity-15 text-secondary/50 dark:text-secondary/30"
          )}
        />
      </div>
      
      {/* Content Container */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          ref={heroRef}
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Badge variant="outline" className="mb-6">
            📚 Documentation
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            MIDAS AI Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive guide to using MIDAS AI for advanced skin cancer detection and medical image analysis.
          </p>
        </motion.div>

        {/* Quick Start */}
        <div ref={quickStartRef} className="mb-20">
          <motion.h2 
            className="text-3xl font-bold mb-12 flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <BookOpen className="mr-3 h-8 w-8" />
            Quick Start Guide
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary p-2 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">Step 1</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Upload Medical Image</h3>
                  <p className="text-muted-foreground">
                    Upload your dermoscopic images in supported formats (JPEG, PNG, DICOM)
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary p-2 rounded-lg">
                      <Brain className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">Step 2</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-3">AI Analysis</h3>
                  <p className="text-muted-foreground">
                    Our advanced AI models analyze the image for potential skin cancer indicators
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary p-2 rounded-lg">
                      <FileText className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">Step 3</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Get Results</h3>
                  <p className="text-muted-foreground">
                    Receive detailed analysis results with confidence scores and recommendations
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>
          </div>
        </div>

        {/* API Documentation */}
        <div ref={apiRef} className="mb-20">
          <motion.h2 
            className="text-3xl font-bold mb-12 flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isApiInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Terminal className="mr-3 h-8 w-8" />
            API Reference
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isApiInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center mb-4">
                    <Badge className="mr-3">POST</Badge>
                    <code className="font-mono text-sm">/api/v1/analyze</code>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Image Analysis</h3>
                  <p className="text-muted-foreground mb-4">
                    Submit medical images for AI-powered skin cancer analysis
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Parameters:</strong> image (file), patient_id (optional)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Response:</strong> Analysis results with confidence scores
                    </p>
                  </div>
                </div>
              </BackgroundGradient>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={isApiInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center mb-4">
                    <Badge className="mr-3">GET</Badge>
                    <code className="font-mono text-sm">/api/v1/results/{'{id}'}</code>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Retrieve Results</h3>
                  <p className="text-muted-foreground mb-4">
                    Retrieve analysis results by result ID
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Parameters:</strong> result_id (required)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Response:</strong> Complete analysis report
                    </p>
                  </div>
                </div>
              </BackgroundGradient>
            </motion.div>
          </div>
        </div>

        {/* Features */}
        <div ref={featuresRef} className="mb-20">
          <motion.h2 
            className="text-3xl font-bold mb-12 flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Lightbulb className="mr-3 h-8 w-8" />
            Key Features
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-8 text-center border border-black/5 dark:border-white/5">
                  <div className="mx-auto bg-primary p-4 rounded-full w-fit mb-6">
                    <Brain className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Advanced AI Models</h3>
                  <p className="text-muted-foreground">
                    State-of-the-art deep learning models trained on millions of medical images
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-8 text-center border border-black/5 dark:border-white/5">
                  <div className="mx-auto bg-primary p-4 rounded-full w-fit mb-6">
                    <Shield className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">HIPAA Compliant</h3>
                  <p className="text-muted-foreground">
                    Enterprise-grade security with full HIPAA compliance and data encryption
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-8 text-center border border-black/5 dark:border-white/5">
                  <div className="mx-auto bg-primary p-4 rounded-full w-fit mb-6">
                    <Zap className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Fast Results</h3>
                  <p className="text-muted-foreground">
                    Get analysis results in under 3 seconds with 97.8% accuracy rate
                  </p>
                </div>
              </BackgroundGradient>
            </motion.div>
          </div>
        </div>

        {/* Call to Action */}
        <motion.div
          ref={ctaRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <BackgroundGradient className="rounded-[30px] p-4">
            <div className="bg-card rounded-3xl p-16 text-center border border-black/5 dark:border-white/5">
              <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of healthcare professionals using MIDAS AI for accurate skin cancer detection.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button className="px-8 py-3">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="px-8 py-3">
                  Download SDK
                  <Download className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </BackgroundGradient>
        </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
