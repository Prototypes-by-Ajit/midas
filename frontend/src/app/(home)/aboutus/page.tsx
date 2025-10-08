
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldCheck, Cpu, Activity, HeartPulse } from "lucide-react";
import Orb from "@/components/ui/shadcn-io/orb";

const KPIS = [
  { label: "Lesion Classes", value: "7+", sub: "Dermoscopic categories" },
  { label: "Image + Metadata", value: "2", sub: "Multimodal inputs" },
  { label: "Avg. Inference", value: "< 120ms", sub: "On GPU serving" },
  { label: "A/B Validations", value: "3", sub: "Clinical pilots" },
];

const VALUES = [
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Privacy by Design", desc: "De-identified pipelines, encryption at rest/in transit, and least-privilege access." },
  { icon: <Cpu className="h-5 w-5" />, title: "Reliable AI", desc: "Versioned datasets, MLflow tracking, and reproducible model registries." },
  { icon: <Activity className="h-5 w-5" />, title: "Clinically Useful", desc: "Decision support with calibrated probabilities and case summaries." },
  { icon: <HeartPulse className="h-5 w-5" />, title: "Patient First", desc: "Human-in-the-loop review and transparent model explanations." },
];

const TEAM = [
  {
    name: "Ajitkumar Senthil Kumar",
    role: "ML Engineer • Data Science @ UB",
    bio: "Builds end-to-end MLOps: data pipelines, training, evaluation, and GPU inference services.",
    dial : `"Enthusiastic product dev with ML and AI background"`,
    avatar: "../../../.././ajit_prof.png", 
    tags: ["MLOps", "PyTorch", "RAG", "FastAPI"],
    links: [{ label: "Portfolio", href: "https://ajitkumar.io" }, { label: "GitHub", href: "https://github.com/Ajitkumar-1001" }],
  },
  {
    name: "Manoj Maheshwar Jagadeesan",
    role: "Research Engineer • Artificial Intelligence @ UB",
    bio: "Focuses on multimodal modeling, attention mechanisms, and clinical evaluation workflows.",
    dial:`"Enthusiastic product dev with ML and AI background"`,
    avatar: "../../../.././manoj.png",
    tags: ["Multimodal", "Attention", "CV", "Evaluation"],
    links: [{ label: "Portfolio", href: "https://manoj.ai/" }, { label: "Github", href: "https://github.com/manojmaheshwarjg" }],
  },
];

const TECH = ["PyTorch", "timm", "Optuna", "FastAPI", "PostgreSQL", "Docker", "MLflow", "Weights & Biases", "Vercel/Render", "Tailwind", "shadcn/ui"];

export default function About() {
  return (
    <main className="min-h-screen z-0">
      {/* Hero */}
      <section className="container mx-auto p-15 px-4 py-12 md:py-35 relative">
        <Orb
          className="absolute inset-0 w-full h-full z-0"
          hue={0}
          hoverIntensity={0.2}
          rotateOnHover={true}
          forceHoverState={false}
        />
        <div className="mx-auto max-w-4xl text-center space-y-6 relative z-10">
          <motion.h1
            className="text-3xl md:text-7xl font-extrabold tracking-tight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            We Bring AI with Innovation to Application and Products.
          </motion.h1>

        <p className="text-muted-foreground text-lg md:text-xl">
        We’re a small research-driven team from the University at Buffalo exploring how modern AI can responsibly support clinicians. Our work sits at the intersection of machine learning, human factors, and healthcare workflows. We care about rigor, safety, and clarity—shipping ideas only when they’re understandable and verifiable.
          </p>

          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary">Research-driven</Badge>
            <Badge variant="secondary">Artifical Intelligence</Badge>
            <Badge variant="secondary">Machine Learning</Badge>
            <Badge variant="secondary">Security-Privacy</Badge>
          </div>
        </div>

        {/* KPI Cards */}
        {/* <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{k.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div> */}
      </section>

      <Separator className="container mx-auto" />

      {/* What we do */}
      <section className="container mx-auto px-4 py-12 md:py-18 grid lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-2xl md:text-5xl font-bold space-y-4">Mission in MIDAS</h2>
          <p className="text-muted-foreground text-xl">MIDAS (Multimodel Intelligent Dermatology Analysis System) was built on an Idea, where blending AI's neurals to the Deep Neural thinking on Analysis Aspect trained to perfection</p>
          <p className="text-muted-foreground text-xl">
          At MIDAS, our mission is to empower healthcare professionals with trustworthy, multimodal AI tools that enhance clinical decision-making in dermatology. By combining dermoscopic imaging with patient metadata, we deliver insights that are not only accurate but also contextually informed — helping clinicians detect and classify skin conditions with confidence and clarity.
          </p>
{/* 
          <div className="grid sm:grid-cols-2 gap-3">
            {VALUES.map((v) => (
              <Card key={v.title} className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  {v.icon}
                  <CardTitle className="text-base">{v.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{v.desc}</CardContent>
              </Card>
            ))}
          </div> */}
        </div>

        <div className="relative py-10 aspect-[16/11] w-full rounded-2xl border bg-muted overflow-hidden">
          {/* Replace with real product image or diagram */}
          <Image
            src="/midas-demo.png"
            alt="MIDAS decision support"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </section>

      {/* Team */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-5xl font-bold text-center">Our Team</h2>
        <p className="text-center text-2xl  text-muted-foreground mt-2">People who turn research into reliable software.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {TEAM.map((m) => (
            <Card key={m.name} className="shadow-3xl bg-gradient-to-t from-gray-100 via-transparent to-gray-100 dark:from-gray-800 dark:via-transparent dark:to-gray-800">
              <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="h-50 w-50 border-2 rounded-full border-black dark:border-white">
                  <AvatarImage src={m.avatar} className="object-cover" />
                  <AvatarFallback>{m.name.split(" ").map(w => w[0]).join("").slice(0,2)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="leading-tight text-3xl">{m.name}</CardTitle>
                  <p className="text-xl text-muted-foreground">{m.role}</p>
                  <h3 className="text-lg italic text-muted-foreground mt-3">{m.dial}</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg text-muted-foreground">{m.bio}</p>
                <div className="flex flex-wrap gap-2">
                  {m.tags.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {m.links.map((l) => (
                    <Button asChild key={l.label} variant="secondary" size="sm" className="gap-1">
                      <a href={l.href} target="_blank" rel="noreferrer">
                        {l.label} <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Engineering Stack */}
      <section className="container mx-auto px-4 pb-12">
        <Card className="shadow-sm bg-gradient-to-t from-gray-100 via-transparent to-white dark:from-gray-800 dark:via-transparent dark:to-gray-900 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-center text-3xl">Engineering Stack</CardTitle>
            <Separator></Separator>
          </CardHeader>
          <CardContent className="relative py-8">
            <div className="flex overflow-hidden">
              <motion.div
                className="flex gap-6 whitespace-nowrap"
                animate={{ x: [0, -1920] }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 25,
                    ease: "linear",
                  },
                }}
              >
                {TECH.concat(TECH, TECH).map((t, index) => (
                  <Badge
                    key={`${t}-${index}`}
                    variant="outline"
                    className="text-lg px-4 py-2 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm border-2 hover:bg-white dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                  >
                    {t}
                  </Badge>
                ))}
              </motion.div>
            </div>

            {/* Gradient fade effects */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 dark:to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 dark:to-transparent pointer-events-none" />
          </CardContent>
        </Card>
      </section>

      {/* Governance & Quality - Apple Cards Carousel */}
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center mb-12">
          <motion.h2
            className="text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Governance & Quality
          </motion.h2>
          <motion.p
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Our commitment to excellence through structured processes and ethical AI practices
          </motion.p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex overflow-x-auto pb-10 gap-6 snap-x snap-mandatory scrollbar-hide">
            {[
              {
                title: "Dataset Versioning",
                subtitle: "Complete Audit Trails",
                description: "Every dataset change is tracked with comprehensive versioning, experiment lineage, and full audit trails through MLflow integration.",
                icon: "🔄",
                features: ["Version Control", "Audit Trails", "MLflow Integration", "Data Lineage"]
              },
              {
                title: "Bias Monitoring",
                subtitle: "Fairness & Equality",
                description: "Continuous monitoring with calibration curves and comprehensive per-subgroup metrics to ensure equitable AI outcomes across all demographics.",
                icon: "⚖️",
                features: ["Calibration Curves", "Fairness Metrics", "Subgroup Analysis", "Bias Detection"]
              },
              {
                title: "Privacy Protection",
                subtitle: "Security First",
                description: "PHI-safe workflows with robust encryption, role-based access controls, and full compliance with healthcare regulations like HIPAA.",
                icon: "🔒",
                features: ["HIPAA Compliance", "Data Encryption", "Access Control", "Privacy by Design"]
              }
            ].map((card, index) => (
              <motion.div
                key={card.title}
                className="snap-center shrink-0"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <motion.div
                  className="w-80 h-96 bg-gradient-to-t from-gray-100 via-transparent to-white dark:from-gray-800 dark:via-transparent dark:to-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 relative overflow-hidden group cursor-pointer"
                  whileHover={{
                    scale: 1.05,
                    rotateY: 5,
                    z: 50
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20
                  }}
                >
                  {/* Floating icon */}
                  <motion.div
                    className="absolute top-6 right-6 text-4xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"
                    animate={{
                      y: [0, -10, 0],
                      rotate: [0, 5, 0]
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {card.icon}
                  </motion.div>

                  {/* Main icon */}
                  <motion.div
                    className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground text-2xl shadow-lg mb-6"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    {card.icon}
                  </motion.div>

                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {card.title}
                    </h3>
                    <p className="text-sm font-semibold mb-4 text-primary">
                      {card.subtitle}
                    </p>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {card.description}
                    </p>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-2">
                      {card.features.slice(0, 3).map((feature, featureIndex) => (
                        <motion.div
                          key={feature}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.2 + featureIndex * 0.1
                          }}
                        >
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {feature}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full bg-muted-foreground/30 transition-all duration-300"
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/40">
        <div className="container mx-auto px-4 py-12 md:py-16 grid gap-6 md:grid-cols-2 items-center">
          <div>
            <h3 className="text-5xl font-bold">Collaborate with us</h3>
            <p className="text-xl text-muted-foreground  mt-2">
              Interested in research partnerships, Building-AI applications, Talk-Tech, clinical pilots, or security reviews? We’d love to talk.
            </p>
          </div>
          <div className="flex md:justify-end gap-3">
            <Button asChild variant="outline">
              <a href="/docs">Read the Docs</a>
            </Button>
            <Button asChild>
              <a href="/contact">Contact Us</a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
