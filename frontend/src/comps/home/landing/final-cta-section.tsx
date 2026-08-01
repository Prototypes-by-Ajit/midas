"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";

import { Button } from "@/components/ui/button";
import TrustBadges from "@/comps/home/trust-badges";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";

export default function FinalCtaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  const isSectionInView = useInView(sectionRef, VIEW_ONCE_HEADER);
  const isBackgroundInView = useInView(backgroundRef, VIEW_ONCE_SECTION);
  const isContentInView = useInView(contentRef, { once: true, margin: "-200px" });
  const isButtonInView = useInView(buttonRef, { once: true, margin: "-250px" });
  const isBadgesInView = useInView(badgesRef, { once: true, margin: "-300px" });

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-[60vh] flex items-center justify-center px-4 py-20 relative"
      initial={{ opacity: 0 }}
      animate={isSectionInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Background gradient - appears first */}
      <motion.div
        ref={backgroundRef}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={isBackgroundInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.0, delay: 0.2 }}
        className="absolute inset-0 bg-gradient-to-b from-background to-background/50 -z-10"
      />

      {/* Content - appears after background */}
      <motion.div
        ref={contentRef}
        initial={{ opacity: 0, y: 40 }}
        animate={isContentInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="text-center max-w-4xl mx-auto"
      >
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-8 leading-tight">
          Ready to transform
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            healthcare with AI?
          </span>
        </h2>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Join the future of dermatological diagnosis. Start your journey with MIDAS today.
        </p>

        {/* Buttons - appear after content */}
        <motion.div
          ref={buttonRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isButtonInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-6 justify-center"
        >
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto px-12 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Link href="/login">Start Free Analysis</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-12 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
          >
            <Link href="/contact">Contact Us</Link>
          </Button>
        </motion.div>

        {/* Badges - appear last */}
        <motion.div
          ref={badgesRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isBadgesInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-wrap items-center justify-center gap-8 mt-12 text-sm text-muted-foreground"
        >
          <TrustBadges />
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
