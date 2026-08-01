"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { ArrowRight, BookOpen, Download, Lightbulb, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import { API_ENDPOINTS, DOC_FEATURES, QUICK_START_STEPS } from "@/data/home/docs";

export default function DocsContent() {
  const heroRef = useRef<HTMLDivElement>(null);
  const quickStartRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const isHeroInView = useInView(heroRef, VIEW_ONCE_HEADER);
  const isQuickStartInView = useInView(quickStartRef, VIEW_ONCE_SECTION);
  const isApiInView = useInView(apiRef, VIEW_ONCE_SECTION);
  const isFeaturesInView = useInView(featuresRef, VIEW_ONCE_SECTION);
  const isCtaInView = useInView(ctaRef, VIEW_ONCE_SECTION);

  return (
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
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6">MIDAS AI Documentation</h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Comprehensive guide to using MIDAS AI for advanced skin cancer detection and medical image
          analysis.
        </p>
      </motion.div>

      {/* Quick Start */}
      <div ref={quickStartRef} className="mb-20">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <BookOpen className="mr-3 h-8 w-8" />
          Quick Start Guide
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {QUICK_START_STEPS.map(({ icon: Icon, step, title, description }, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 30 }}
              animate={isQuickStartInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.2 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary p-2 rounded-lg">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">{step}</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{title}</h3>
                  <p className="text-muted-foreground">{description}</p>
                </div>
              </BackgroundGradient>
            </motion.div>
          ))}
        </div>
      </div>

      {/* API Documentation */}
      <div ref={apiRef} className="mb-20">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isApiInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Terminal className="mr-3 h-8 w-8" />
          API Reference
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-8">
          {API_ENDPOINTS.map((endpoint, index) => (
            <motion.div
              key={endpoint.path}
              initial={{ opacity: 0, x: index === 0 ? -30 : 30 }}
              animate={isApiInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.2 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-6 border border-black/5 dark:border-white/5">
                  <div className="flex items-center mb-4">
                    <Badge className="mr-3">{endpoint.method}</Badge>
                    <code className="font-mono text-sm">{endpoint.path}</code>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{endpoint.title}</h3>
                  <p className="text-muted-foreground mb-4">{endpoint.description}</p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Parameters:</strong> {endpoint.parameters}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Response:</strong> {endpoint.response}
                    </p>
                  </div>
                </div>
              </BackgroundGradient>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div ref={featuresRef} className="mb-20">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Lightbulb className="mr-3 h-8 w-8" />
          Key Features
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {DOC_FEATURES.map(({ icon: Icon, title, description }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.2 }}
            >
              <BackgroundGradient className="rounded-[22px] p-3">
                <div className="bg-card rounded-2xl p-8 text-center border border-black/5 dark:border-white/5">
                  <div className="mx-auto bg-primary p-4 rounded-full w-fit mb-6">
                    <Icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">{title}</h3>
                  <p className="text-muted-foreground">{description}</p>
                </div>
              </BackgroundGradient>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Call to Action — buttons are intentionally inert, as before */}
      <motion.div
        ref={ctaRef}
        initial={{ opacity: 0, y: 30 }}
        animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <BackgroundGradient className="rounded-[30px] p-4">
          <div className="bg-card rounded-3xl p-8 sm:p-12 md:p-16 text-center border border-black/5 dark:border-white/5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join thousands of healthcare professionals using MIDAS AI for accurate skin cancer
              detection.
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
  );
}
