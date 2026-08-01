"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, itemVariants, slideInVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { TECHNOLOGY_FEATURES } from "@/data/home/learn-more";

export default function TechnologySection() {
  const techRef = useRef<HTMLElement>(null);
  const isTechInView = useInView(techRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={techRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isTechInView ? "visible" : "hidden"}
    >
      <motion.div className="text-center mb-12 sm:mb-14 md:mb-16" variants={slideInVariants}>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
          Technology Deep Dive
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
          Understanding the advanced machine learning and clinical validation behind MIDAS
        </p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
        {TECHNOLOGY_FEATURES.map(({ icon: Icon, title, description, items }) => (
          <motion.div key={title} variants={itemVariants}>
            <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
              <div className="absolute top-0 left-0 w-full h-1 bg-black dark:bg-white transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-xl text-black dark:text-white">{title}</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                  {description}
                </p>

                <div className="space-y-3">
                  {items.map((detail) => (
                    <div key={detail} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-black dark:text-white flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{detail}</span>
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
