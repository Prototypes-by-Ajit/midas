"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { FileText, GraduationCap, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoVideoTrigger } from "@/comps/home/demo-video-modal";
import { containerVariants, itemVariants, slideInVariants } from "@/motion/variants";
import { VIEW_ONCE_HEADER } from "@/motion/viewport";

export default function HeaderSection() {
  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderInView = useInView(headerRef, VIEW_ONCE_HEADER);

  return (
    <motion.div
      ref={headerRef}
      className="text-center mb-20"
      variants={containerVariants}
      initial="hidden"
      animate={isHeaderInView ? "visible" : "hidden"}
    >
      <motion.div variants={slideInVariants}>
        <Badge className="mb-6 bg-black/5 text-black border-black/20 dark:bg-white/10 dark:text-white dark:border-white/20">
          <GraduationCap className="h-4 w-4 mr-2" />
          Learn More
        </Badge>
      </motion.div>

      <motion.h1
        className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 text-black dark:text-white px-4"
        variants={itemVariants}
      >
        The Science Behind MIDAS
      </motion.h1>

      <motion.p
        className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4"
        variants={itemVariants}
      >
        Discover how cutting-edge AI research, clinical validation, and healthcare expertise combine
        to create the most trusted skin cancer detection platform
      </motion.p>

      <motion.div
        className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="w-full sm:w-auto">
          <DemoVideoTrigger
            size="lg"
            className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
          >
            <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            Watch Demo
          </DemoVideoTrigger>
        </motion.div>
        <motion.div variants={itemVariants} className="w-full sm:w-auto">
          <Link href="/docs" className="w-full sm:w-auto block">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full"
            >
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Documentation
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
