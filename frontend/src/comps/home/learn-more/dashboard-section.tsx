"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Activity, Monitor } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { DemoVideoTrigger } from "@/comps/home/demo-video-modal";
import {
  containerVariants,
  itemVariants,
  scaleVariants,
  slideInVariants,
} from "@/motion/variants";
import { VIEW_ONCE_SECTION } from "@/motion/viewport";
import { DASHBOARD_FEATURES } from "@/data/home/learn-more";

export default function DashboardSection() {
  const dashboardRef = useRef<HTMLElement>(null);
  const isDashboardInView = useInView(dashboardRef, VIEW_ONCE_SECTION);

  return (
    <motion.section
      ref={dashboardRef}
      className="mb-24"
      variants={containerVariants}
      initial="hidden"
      animate={isDashboardInView ? "visible" : "hidden"}
    >
      <motion.div className="text-center mb-12 sm:mb-14 md:mb-16" variants={slideInVariants}>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-black dark:text-white px-4">
          Powerful Dashboard
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
          Experience seamless workflow integration with our intuitive, feature-rich dashboard
          designed for healthcare professionals
        </p>
      </motion.div>

      {/* Dashboard Preview Card */}
      <motion.div className="mb-16" variants={scaleVariants}>
        <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-700 bg-white/95 dark:bg-black/95 backdrop-blur">
          <div className="absolute top-0 left-0 w-full h-2 bg-black dark:bg-white transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-1000" />

          <CardContent className="p-6 sm:p-8 md:p-10 lg:p-12">
            <div className="text-center mb-8 sm:mb-10 md:mb-12">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Activity className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-black dark:text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-black dark:text-white px-4">
                Interactive Dashboard Preview
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
                Get a glimpse of the powerful analytics, patient management, and AI insights that
                drive better healthcare outcomes
              </p>
            </div>

            <div className="text-center px-4">
              <DemoVideoTrigger
                size="lg"
                className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
              >
                <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />
                View Live Demo
              </DemoVideoTrigger>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Dashboard Features Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {DASHBOARD_FEATURES.map(({ icon: Icon, title, description, items }) => (
          <motion.div key={title} variants={itemVariants}>
            <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
              <div className="absolute top-0 left-0 w-full h-1 bg-black dark:bg-white transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg text-black dark:text-white">{title}</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed text-sm">
                  {description}
                </p>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{item}</span>
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
