"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, Lightbulb, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, itemVariants } from "@/motion/variants";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import { API_ENDPOINTS, DOC_FEATURES, QUICK_START_STEPS } from "@/data/home/docs";

/**
 * Top hover accent shared with the aboutus, privacy, terms and learn-more
 * cards. Pure CSS transform, so it composites and the global
 * prefers-reduced-motion reset in globals.css already neutralises it.
 */
const ACCENT_BAR =
  "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500";

const CARD = "group relative overflow-hidden border hover:shadow-lg transition-all duration-300 h-full";

export default function DocsContent() {
  const heroRef = useRef<HTMLDivElement>(null);
  const quickStartRef = useRef<HTMLElement>(null);
  const apiRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const isHeroInView = useInView(heroRef, VIEW_ONCE_HEADER);
  const isQuickStartInView = useInView(quickStartRef, VIEW_ONCE_SECTION);
  const isApiInView = useInView(apiRef, VIEW_ONCE_SECTION);
  const isFeaturesInView = useInView(featuresRef, VIEW_ONCE_SECTION);
  const isCtaInView = useInView(ctaRef, VIEW_ONCE_SECTION);

  /*
   * globals.css neutralises CSS animation and transition for reduced-motion
   * users, but motion/react drives inline styles from rAF and is untouched by
   * it. Skipping the initial state is what actually honours the preference:
   * content renders in its final position with no reveal.
   */
  const shouldReduceMotion = useReducedMotion();
  const initial = shouldReduceMotion ? false : "hidden";
  const reveal = (inView: boolean) => (shouldReduceMotion || inView ? "visible" : "hidden");

  return (
    <div className="container mx-auto px-4 py-8 relative z-10">
      {/* Header */}
      <motion.div
        ref={heroRef}
        className="text-center mb-20"
        variants={containerVariants}
        initial={initial}
        animate={reveal(isHeroInView)}
      >
        <motion.div variants={itemVariants}>
          <Badge
            variant="outline"
            className="mb-6 bg-black/5 text-black border-black/20 dark:bg-white/10 dark:text-white dark:border-white/20"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Documentation
          </Badge>
        </motion.div>
        <motion.h1
          className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6"
          variants={itemVariants}
        >
          MIDAS AI Documentation
        </motion.h1>
        <motion.p
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto"
          variants={itemVariants}
        >
          Comprehensive guide to using MIDAS AI for advanced skin cancer detection and medical image
          analysis.
        </motion.p>
      </motion.div>

      {/* Quick Start */}
      <motion.section
        ref={quickStartRef}
        className="mb-20"
        variants={containerVariants}
        initial={initial}
        animate={reveal(isQuickStartInView)}
      >
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          variants={itemVariants}
        >
          <BookOpen className="mr-3 h-8 w-8" />
          Quick Start Guide
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-6">
          {QUICK_START_STEPS.map(({ icon: Icon, step, title, description }) => (
            <motion.div key={step} variants={itemVariants}>
              <Card className={CARD}>
                <div className={ACCENT_BAR} />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary p-2 rounded-lg">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">{step}</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{title}</h3>
                  <p className="text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* API Documentation */}
      <motion.section
        ref={apiRef}
        className="mb-20"
        variants={containerVariants}
        initial={initial}
        animate={reveal(isApiInView)}
      >
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          variants={itemVariants}
        >
          <Terminal className="mr-3 h-8 w-8" />
          API Reference
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-6">
          {API_ENDPOINTS.map((endpoint) => (
            <motion.div key={endpoint.path} variants={itemVariants}>
              <Card className={CARD}>
                <div className={ACCENT_BAR} />
                <CardContent className="p-6">
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        ref={featuresRef}
        className="mb-20"
        variants={containerVariants}
        initial={initial}
        animate={reveal(isFeaturesInView)}
      >
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 flex items-center justify-center"
          variants={itemVariants}
        >
          <Lightbulb className="mr-3 h-8 w-8" />
          Key Features
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-6">
          {DOC_FEATURES.map(({ icon: Icon, title, description }) => (
            <motion.div key={title} variants={itemVariants}>
              <Card className={CARD}>
                <div className={ACCENT_BAR} />
                <CardContent className="p-6 text-center">
                  <div className="mx-auto bg-primary p-4 rounded-full w-fit mb-6">
                    <Icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">{title}</h3>
                  <p className="text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Call to Action */}
      <motion.div
        ref={ctaRef}
        variants={containerVariants}
        initial={initial}
        animate={reveal(isCtaInView)}
      >
        <Card className="border bg-muted/40">
          <CardContent className="p-8 sm:p-12 md:p-16 text-center">
            <motion.h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6"
              variants={itemVariants}
            >
              Ready to Get Started?
            </motion.h2>
            <motion.p
              className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
              variants={itemVariants}
            >
              Explore MIDAS AI as a second-opinion tool for dermoscopic image review.
            </motion.p>
            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center"
              variants={itemVariants}
            >
              <Button asChild className="px-8 py-3">
                <Link href="/login">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="px-8 py-3">
                <Link href="/learn-more">Learn More</Link>
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
