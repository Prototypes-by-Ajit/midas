"use client"

export const dynamic = "force-dynamic"
export const revalidate = 0


import { motion } from "motion/react";

export default function Support() { 
    return ( 
        <div className="min-h-screen text-foreground bg-background py-20">
            <motion.div 
                className="w-full max-w-5xl flex flex-col items-center justify-center mx-auto p-5"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
            >
                <h1 className="text-4xl md:text-6xl font-bold mb-8 text-center">
                    Support Center
                </h1>
                <h2 className="text-2xl font-sans font-extrabold leading-relaxed text-foreground text-center">
                    We offer extended support for our customers and audience.
                </h2>
            </motion.div>
        </div>
    )
}