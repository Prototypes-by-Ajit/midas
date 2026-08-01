"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCircle, Clock, Gavel, Mail, Scale } from "lucide-react";

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
  LEGAL_HIGHLIGHTS,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
} from "@/data/home/terms";

export default function TermsContent() {
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLElement>(null);
  const highlightsRef = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  const isHeaderInView = useInView(headerRef, VIEW_ONCE_HEADER);
  const isSectionsInView = useInView(sectionsRef, VIEW_ONCE_SECTION);
  const isHighlightsInView = useInView(highlightsRef, VIEW_ONCE_SECTION);
  const isNoticeInView = useInView(noticeRef, VIEW_ONCE_SECTION);
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
            <Scale className="h-4 w-4 mr-2" />
            Terms &amp; Conditions
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-7xl font-bold mb-8 text-black dark:text-white"
          variants={itemVariants}
        >
          Terms of Service
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-10 leading-relaxed"
          variants={itemVariants}
        >
          These terms and conditions govern your use of MIDAS AI services. By accessing our
          platform, you agree to be bound by these terms and our privacy policy.
        </motion.p>

        <motion.div variants={itemVariants}>
          <div className="bg-gray-50/50 dark:bg-gray-900/20 border border-gray-200/50 dark:border-gray-800/50 rounded-xl p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span className="font-semibold text-orange-900 dark:text-orange-100">
                Effective Date
              </span>
            </div>
            <p className="text-gray-800 dark:text-gray-200 text-sm">
              These terms became effective on {TERMS_EFFECTIVE_DATE}. Please review these terms
              regularly as they may be updated to reflect changes in our services or legal
              requirements.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Terms Sections */}
      <motion.section
        ref={sectionsRef}
        className="mb-24"
        variants={containerVariants}
        initial="hidden"
        animate={isSectionsInView ? "visible" : "hidden"}
      >
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {TERMS_SECTIONS.map(({ icon: Icon, title, description, items }) => (
            <motion.div key={title} variants={itemVariants}>
              <Card className="group relative overflow-hidden border-black/10 dark:border-white/10 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 h-full bg-white/90 dark:bg-black/90 backdrop-blur">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700" />

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
                        <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
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

      {/* Legal Highlights */}
      <motion.section
        ref={highlightsRef}
        className="mb-24"
        variants={containerVariants}
        initial="hidden"
        animate={isHighlightsInView ? "visible" : "hidden"}
      >
        <motion.div className="text-center mb-16" variants={slideInVariants}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white">
            Legal Highlights
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Key legal aspects you should be aware of when using our services
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {LEGAL_HIGHLIGHTS.map((highlight) => (
            <motion.div key={highlight.title} variants={scaleVariants}>
              <Card className="text-center group hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 transition-all duration-500 border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur h-full">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3 text-black dark:text-white">
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

      {/* Important Notice — owns its own ref rather than piggybacking the highlights observer */}
      <motion.section
        ref={noticeRef}
        variants={itemVariants}
        initial="hidden"
        animate={isNoticeInView ? "visible" : "hidden"}
        className="mb-24"
      >
        <Card className="border-red-200/50 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/20">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-4 text-red-900 dark:text-red-100">
                  Important Medical Disclaimer
                </h3>
                <p className="text-red-800 dark:text-red-200 leading-relaxed mb-4">
                  MIDAS provides AI-powered analysis tools to assist healthcare professionals in
                  skin lesion evaluation. Our technology is designed to support, not replace,
                  clinical decision-making by qualified medical practitioners.
                </p>
                <p className="text-red-800 dark:text-red-200 leading-relaxed">
                  All diagnoses, treatment decisions, and patient care recommendations must be made
                  by licensed healthcare providers based on their professional judgment, considering
                  all relevant clinical information and patient history.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                <Gavel className="h-10 w-10 text-black dark:text-white" />
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-black dark:text-white">
                Questions About Terms?
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
                If you have questions about these terms or need clarification on any aspect of our
                service agreement, our legal team is available to help.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button
                  size="lg"
                  className="gap-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 px-8 py-6 text-lg"
                >
                  Contact Legal Team
                  <Mail className="h-5 w-5" />
                </Button>
                <Link href="/privacy">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black px-8 py-6 text-lg"
                  >
                    Privacy Policy
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
