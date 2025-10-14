"use client";

import { motion } from "motion/react";

export default function Help() {
  return (
    <div className="min-h-screen bg-background text-foreground py-20 mt-15">
      <main className="container mx-auto">
        <motion.section 
          className="max-w-4xl w-full flex flex-col items-center p-2 mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-8 text-center">
            Help Center
          </h1>
          <p className="text-xl text-muted-foreground text-center mb-8">
            Find answers and get support for MIDAS AI
          </p>
        </motion.section>
      </main>
    </div>
  )
}
