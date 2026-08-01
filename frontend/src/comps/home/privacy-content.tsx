"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCircle, Mail, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  containerVariants,
  itemVariants,
  scaleVariants,
  slideInVariants,
} from "@/motion/variants";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import {
  KEY_COMMITMENTS,
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
} from "@/data/home/privacy";

export default function PrivacyContent() {
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLElement>(null);
  const commitmentsRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  const isHeaderInView = useInView(headerRef, VIEW_ONCE_HEADER);
  const isSectionsInView = useInView(sectionsRef, VIEW_ONCE_SECTION);
  const isCommitmentsInView = useInView(commitmentsRef, VIEW_ONCE_SECTION);
  const isContactInView = useInView(contactRef, VIEW_ONCE_SECTION);

  return (
    <div className="container mx-auto px-4 py-12 relative z-10">
      {/* Header Section */}
      <motion.div
        ref={headerRef}
        className="text-center mb-20"
        variants={containerVariants}
        initial="hidden"
        animate={isHeaderInView ? "visible" : "hidden"}
      >
        <motion.div variants={slideInVariants}>
          <Badge className="mb-6 bg-black/5 text-black border-black/20 dark:bg-white/10 dark:text-white dark:border-white/20">
            <Shield className="h-4 w-4 mr-2" />
            Privacy Policy
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-7xl font-bold mb-8 text-black dark:text-white"
          variants={itemVariants}
        >
          Your Privacy Matters
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-10 leading-relaxed"
          variants={itemVariants}
        >
          At MIDAS, we are committed to protecting your privacy and ensuring the security of your
          medical information. This privacy policy explains how we collect, use, and protect your
          data.
        </motion.p>

        <motion.div variants={itemVariants}>
          <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Last Updated</span>
            </div>
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              This privacy policy was last updated on {PRIVACY_LAST_UPDATED}. We may update this
              policy periodically to reflect changes in our practices or applicable laws.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Privacy Sections */}
      <motion.section
        ref={sectionsRef}
        className="mb-24"
        variants={containerVariants}
        initial="hidden"
        animate={isSectionsInView ? "visible" : "hidden"}
      >
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {PRIVACY_SECTIONS.map(({ icon: Icon, title, description, items }) => (
            <motion.div key={title} variants={itemVariants}>
              <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center text-black dark:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-xl text-black dark:text-white">{title}</h3>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    {description}
                  </p>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm">
                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
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

      {/* Key Commitments */}
      <motion.section
        ref={commitmentsRef}
        className="mb-24"
        variants={containerVariants}
        initial="hidden"
        animate={isCommitmentsInView ? "visible" : "hidden"}
      >
        <motion.div className="text-center mb-16" variants={slideInVariants}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">
            Our Commitments
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Core principles that guide our approach to data privacy and protection
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {KEY_COMMITMENTS.map((commitment) => (
            <motion.div key={commitment.title} variants={scaleVariants}>
              <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur h-full">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3 text-black dark:text-white">
                    {commitment.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {commitment.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Contact Section */}
      <motion.section
        ref={contactRef}
        className="mb-12"
        variants={scaleVariants}
        initial="hidden"
        animate={isContactInView ? "visible" : "hidden"}
      >
        <Card className="bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 backdrop-blur">
          <CardContent className="p-6 sm:p-10 md:p-16 text-center">
            <div className="max-w-4xl mx-auto">
              <div className="w-20 h-20 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Mail className="h-10 w-10 text-black dark:text-white" />
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-black dark:text-white">
                Questions About Privacy?
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
                If you have any questions about this privacy policy or how we handle your data, our
                privacy team is here to help. Contact us for clarification or concerns.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button
                  size="lg"
                  className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-8 py-6 text-lg"
                >
                  Contact Privacy Team
                  <Mail className="h-5 w-5" />
                </Button>
                <Link href="/terms">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-8 py-6 text-lg"
                  >
                    Terms &amp; Conditions
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
