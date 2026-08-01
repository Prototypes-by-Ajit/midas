"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, itemVariants, slideInVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { USE_CASES } from "@/data/home/learn-more";

export default function UseCasesSection() {
  const useCasesRef = useRef<HTMLElement>(null);
  const isUseCasesInView = useInView(useCasesRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={useCasesRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isUseCasesInView ? "visible" : "hidden"}
    >
      <motion.div className="text-center mb-12 sm:mb-14 md:mb-16" variants={slideInVariants}>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
          Real-World Applications
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
          How healthcare organizations worldwide are leveraging MIDAS for improved patient outcomes
        </p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2">
        {USE_CASES.map(({ icon: Icon, title, description, items }) => (
          <motion.div key={title} variants={itemVariants}>
            <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
              <CardContent className="p-8">
                <div className="flex items-start gap-6 mb-6">
                  <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-3 text-black dark:text-white">{title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <h4 className="font-semibold text-sm text-black dark:text-white">
                    Key Benefits:
                  </h4>
                  {items.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-3 text-sm">
                      <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{benefit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
