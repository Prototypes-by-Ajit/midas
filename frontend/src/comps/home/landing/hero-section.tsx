"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";

import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { HeroParallax } from "@/components/ui/hero-parallax";
import TrustBadges from "@/comps/home/trust-badges";
import { MIDAS_PRODUCTS } from "@/data/home/landing";

/**
 * Above-the-fold hero copy. Passed to HeroParallax as the `header` prop —
 * legal because both live in this same client module, so no server→client
 * serialization happens.
 *
 * HeroParallax itself is a plain import, not a lazy island: it carries the
 * page's <h1> and must server-render.
 */
function MidasHero() {
  return (
    <div className="max-w-7xl relative mx-auto py-20 md:py-40 px-4 w-full left-0 top-0">
      <BlurFade delay={0.2} duration={0.8}>
        <h1 className="text-4xl md:text-7xl font-bold dark:text-white text-foreground leading-tight">
          Advanced AI-Powered <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            Skin Cancer Detection
          </span>
        </h1>
      </BlurFade>

      <BlurFade delay={0.5} duration={0.8}>
        <p className="max-w-2xl text-base md:text-xl mt-8 dark:text-neutral-200 text-muted-foreground leading-relaxed">
          MIDAS leverages cutting-edge machine learning to provide accurate, fast, and reliable skin
          cancer classification. Trusted by healthcare professionals worldwide for early detection
          and precision diagnosis.
        </p>
      </BlurFade>

      <BlurFade delay={0.8} duration={0.8}>
        <div className="flex flex-col sm:flex-row gap-6 mt-12">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Link href="/login">Start Free Analysis</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
          >
            <Link href="/learn-more">Learn More</Link>
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={1.1} duration={0.8}>
        <div className="flex flex-wrap items-center justify-start gap-8 mt-12 text-sm text-muted-foreground">
          <TrustBadges />
        </div>
      </BlurFade>
    </div>
  );
}

export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const isHeroInView = useInView(heroRef, { once: true, margin: "-200px" });

  return (
    <motion.div
      ref={heroRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
    >
      <HeroParallax products={MIDAS_PRODUCTS} header={<MidasHero />} />
    </motion.div>
  );
}
