"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, scaleVariants, slideInVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { RESEARCH_HIGHLIGHTS } from "@/data/home/learn-more";

export default function ResearchSection() {
  const researchRef = useRef<HTMLElement>(null);
  const isResearchInView = useInView(researchRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={researchRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isResearchInView ? "visible" : "hidden"}
    >
      <motion.div className="text-center mb-12 sm:mb-14 md:mb-16" variants={slideInVariants}>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
          Research &amp; Validation
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
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
                <h3 className="font-bold text-lg mb-4 text-black dark:text-white">
                  {highlight.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {highlight.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
