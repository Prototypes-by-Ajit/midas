"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";

import { Button } from "@/components/ui/button";
import ProcessGrid from "@/components/effects/process-grid";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";

export default function ProcessSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const isSectionInView = useInView(sectionRef, VIEW_ONCE_HEADER);
  const isBackgroundInView = useInView(backgroundRef, { once: true, margin: "-200px" });
  const isContentInView = useInView(contentRef, VIEW_ONCE_SECTION);
  const isCtaInView = useInView(ctaRef, { once: true, margin: "-200px" });

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-screen relative w-full flex items-center justify-center py-20 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={isSectionInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Interactive Grid Pattern Background - appears first */}
      <motion.div
        ref={backgroundRef}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={isBackgroundInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.0, delay: 0.2 }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
        <ProcessGrid />
      </motion.div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Content description - appears after background */}
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isContentInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mb-20"
        >
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
            Your ideal diagnosis may exist across many approaches at MIDAS. Explore our AI to see
            which could be the next step in your healthcare journey.
          </p>
        </motion.div>

        {/* Main content - appears after description */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isContentInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center"
        >
          <h3 className="text-md uppercase tracking-wider text-muted-foreground mb-8">
            AI-Powered Analysis
          </h3>
          <h2 className="font-bold mb-10 sm:mb-14 md:mb-16 leading-tight space-y-2">
            <span className="block text-3xl sm:text-5xl md:text-7xl">Join people who share</span>
            <span className="block text-3xl sm:text-5xl md:text-7xl">your passion and</span>
            <span className="block text-3xl sm:text-5xl md:text-7xl">complement your</span>
            <span className="block text-3xl sm:text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
              expertise.
            </span>
          </h2>

          {/* CTA buttons - appear last */}
          <motion.div
            ref={ctaRef}
            initial={{ opacity: 0, y: 20 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-6 justify-center max-w-lg mx-auto"
          >
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
            >
              <Link href="/login">Try MIDAS</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
            >
              <Link href="/learn-more">Learn More</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
