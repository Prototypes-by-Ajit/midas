"use client";
import Link from "next/link";
import { default as dynamicImport } from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { Bluetooth } from "lucide-react";
import { Separator } from "@/components/ui/separator";
// import Orb from "@/components/ui/shadcn-io/orb";
import { InteractiveGridPattern } from "@/components/ui/shadcn-io/interactive-grid-pattern";
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

export default function Home() {

  const anim = useAnimation();
  const anim2 = useAnimation();


  const containerVariant1: any = {
    hidden: { opacity: 0, scale: 0 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1.2, delay: 0.8, ease: "easeIn" } }
  };

  const blurVariants = {
    hidden: { filter: "blur(10px)", opacity: 0 },
    visible: { filter: "blur(0px)", opacity: 1, transition: { duration: 0.7 } },
  };

  const Marquee1 = dynamicImport(()=> import("@/components/ui/shadcn-io/marquee").then((mod) => mod.Marquee), {ssr:false})

  useEffect(() => {
    const seq = async () => {
      await anim.start("visible");
      await new Promise((res) => setTimeout(res, 1200));
      await anim2.start("visible");
    };
    seq();
  }, [anim, anim2]);



  return (
    <div className="min-h-screen bg-background py-20 relative">
      {/* Grid Pattern Background with Center Mask */}
      <GridPattern
        width={50}
        height={50}
        className={cn(
          "[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]",
          "absolute inset-0 h-full w-full -z-10 opacity-100",
          "fill-muted-foreground/10 stroke-muted-foreground/10",
          "dark:fill-muted-foreground/5 dark:stroke-muted-foreground/5"
        )}
      />
      
      <main className="mx-auto min-h-screen px-4 py-16 relative z-10">
        <motion.div className="text-center max-w-5xl w-screen mx-auto" variants={blurVariants} initial="hidden" animate={anim}>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 text-balance brightness-200">
            Advanced Skin Cancer Detection Using AI and Machine Learning
          </h1>
          <p className="text-2xl text-muted-foreground mb-8 text-pretty">
            MIDAS leverages cutting-edge machine learning to provide accurate, fast, and reliable skin cancer
            classification. Trusted by healthcare professionals worldwide for early detection and diagnosis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/demo">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Analysis
              </Button>
            </Link>
            <Link href="/help">
              <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                Learn More
              </Button>
            </Link>
          </div>

          <div className="flex mt-2">
            <Marquee1   
              
            />
          </div>

          <motion.div className="grid md:grid-cols-3 gap-8 mt-16" variants={blurVariants} initial="hidden" animate="visible">
            <Card className=" border-2 border-black bg-transparent shadow-3xl">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mt-6">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <CardTitle>99.2% Accuracy</CardTitle>
                <CardDescription>
                  Clinically validated AI model trained on over 100,000 dermatological images
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className=" shadow-3xl border-2 bg-transparent border-gray-500">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mt-6">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <CardTitle>HIPAA Compliant</CardTitle>
                <CardDescription>Enterprise-grade security with end-to-end encryption and audit trails</CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-3xl border-2 bg-transparent border-gray-900 ">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center mx-auto mt-6">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <CardTitle>Instant Results</CardTitle>
                <CardDescription>Get comprehensive analysis reports in under 3 seconds</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>



          {/* Supported Classifications */}
          <motion.div className="flex flex-col items-center mt-20 py-10 space-y-2" variants={blurVariants} initial="hidden" animate={anim2}>
            <h3 className="text-5xl font-extrabold text-foreground">Supported <span className="flex flex-col items-center">Classifications</span></h3>
            <Separator></Separator>
            <h4 className="text-2xl  text-muted-foreground text-gray-500">
              Our Powerful Deep Learning has been trained with a dataset of more than 20k+ images with a multi-class Skin cancer , trained for more than 50+ epochs provided a good result with a high Performance metrics in Precision and Recall.
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {[
                { label: "Melanoma", cls: "bg-gray-200" },
                { label: "Basal Cell Carcinoma", cls: "bg-gray-200" },
                { label: "Squamous Cell Carcinoma", cls: "bg-gray-200" },
                { label: "Actinic Keratosis", cls: "bg-gray-200" },
                { label: "Benign Keratosis", cls: "bg-gray-200" },
                { label: "Dermatofibroma", cls: "bg-gray-200" },
                { label: "Vascular Lesion", cls: "bg-gray-200" },
                { label: "Benign Nevus", cls: "bg-gray-200" },
              ].map((classification, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-2 border-black  ${classification.cls}`}
                >
                  <span className="text-lg font-medium text-primary/90 text-card-foreground">
                    {classification.label}
                  </span>
                  </div>
           
              ))}
              </div>
          </motion.div>
        </motion.div>
      </main>

   

    </div>
  )
}

