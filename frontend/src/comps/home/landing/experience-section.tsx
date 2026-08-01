"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import { EXPERIENCE_PILLARS } from "@/data/home/landing";

export default function ExperienceSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const isSectionInView = useInView(sectionRef, VIEW_ONCE_HEADER);
  const isHeaderInView = useInView(headerRef, VIEW_ONCE_SECTION);
  const isCardsInView = useInView(cardsRef, { once: true, margin: "-200px" });

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-screen flex items-center justify-center px-4 py-20 relative"
      initial={{ opacity: 0 }}
      animate={isSectionInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header appears first */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-8 leading-tight">
            <span className="block text-muted-foreground/60">There&apos;s a place here for</span>
            <span className="block text-xl sm:text-2xl md:text-3xl">every kind of brilliance.</span>
          </h2>
        </motion.div>

        {/* Cards appear after header */}
        <motion.div
          ref={cardsRef}
          initial={{ opacity: 0, y: 40 }}
          animate={isCardsInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {EXPERIENCE_PILLARS.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isCardsInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              className={`p-8 rounded-2xl bg-gradient-to-br ${item.gradient} backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-500 group cursor-pointer relative overflow-hidden`}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
