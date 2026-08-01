"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, itemVariants, slideInVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { SAFETY_MEASURES } from "@/data/home/learn-more";

export default function SafetySection() {
  const safetyRef = useRef<HTMLElement>(null);
  const isSafetyInView = useInView(safetyRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={safetyRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isSafetyInView ? "visible" : "hidden"}
    >
      <motion.div className="text-center mb-12 sm:mb-14 md:mb-16" variants={slideInVariants}>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
          Safety &amp; Compliance
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
          Built with healthcare-grade security and safety measures for responsible AI deployment
        </p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-3">
        {SAFETY_MEASURES.map(({ icon: Icon, title, description }) => (
          <motion.div key={title} variants={itemVariants}>
            <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 text-center h-full bg-white/90 dark:bg-black/90 backdrop-blur">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 text-black dark:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg mb-4 text-black dark:text-white">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
