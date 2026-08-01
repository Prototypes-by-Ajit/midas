"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { containerVariants, scaleVariants } from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { STATS } from "@/data/home/learn-more";

export default function StatsSection() {
  const statsRef = useRef<HTMLElement>(null);
  const isStatsInView = useInView(statsRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={statsRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isStatsInView ? "visible" : "hidden"}
    >
      <div className="grid gap-8 md:grid-cols-4">
        {STATS.map((stat) => (
          <motion.div key={stat.label} variants={scaleVariants}>
            <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur">
              <CardContent className="p-8">
                <div className="text-4xl md:text-5xl font-bold text-black dark:text-white mb-4">
                  {stat.number}
                </div>
                <h3 className="font-semibold text-lg mb-3 text-black dark:text-white">
                  {stat.label}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
