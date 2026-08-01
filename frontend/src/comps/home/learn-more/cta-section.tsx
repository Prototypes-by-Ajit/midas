"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { ArrowRight, CheckCircle, FileText, HeartHandshake, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DemoVideoTrigger } from "@/comps/home/demo-video-modal";
import { scaleVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";

const CTA_ASSURANCES = ["Free 30-day trial", "No setup fees", "24/7 support"];

export default function CtaSection() {
  const ctaRef = useRef<HTMLElement>(null);
  const isCtaInView = useInView(ctaRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={ctaRef}
      className="mb-12"
      variants={scaleVariants}
      initial="hidden"
      animate={isCtaInView ? "visible" : "hidden"}
    >
      <Card className="bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 backdrop-blur relative">
        <CardContent className="p-6 sm:p-10 md:p-16 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="w-20 h-20 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <HeartHandshake className="h-10 w-10 text-black dark:text-white" />
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
              Join the Future of Dermatology
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-10 md:mb-12 leading-relaxed max-w-3xl mx-auto px-4">
              Partner with MIDAS to bring cutting-edge AI-powered skin cancer detection to your
              healthcare organization. Together, we can improve patient outcomes and save lives
              through early detection.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-8 sm:mb-10 md:mb-12 px-4">
              <Button
                size="lg"
                className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <DemoVideoTrigger
                variant="outline"
                size="lg"
                className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
              >
                Watch Demo
                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </DemoVideoTrigger>
              <Link href="/docs" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2 text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/10 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full"
                >
                  Documentation
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600 dark:text-gray-400">
              {CTA_ASSURANCES.map((assurance) => (
                <div key={assurance} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-black dark:text-white" />
                  <span>{assurance}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
