"use client";
import { Button } from "@/components/ui/button";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { HeroParallax } from "@/components/ui/hero-parallax";
import { BlurFade } from "@/components/ui/blur-fade";
import dynamic from "next/dynamic";
import useNavigationLoading from "@/hooks/use-navigation-loading";

const InteractiveGridPattern = dynamic(
  () => import("@/components/ui/shadcn-io/interactive-grid-pattern/index").then((mod) => ({
    default: mod.InteractiveGridPattern
  })),
  {
    ssr: false,
    loading: () => null
  }
);
// Apple-style Experience Section Component
function ExperienceSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-150px" });
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
          <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">
            <span className="block text-muted-foreground/60">There&apos;s a place here for</span>
            <span className="block text-3xl">every kind of brilliance.</span>
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
          {[
            {
              title: "Precision Medicine",
              description: "AI models that understand the nuances of dermatological diagnosis",
              gradient: "from-blue-500/20 to-gray-500/20"
            },
            {
              title: "Clinical Excellence",
              description: "Validated by board-certified dermatologists across multiple institutions",
              gradient: "from-black-500/20 to-gray-500/20"
            },
            {
              title: "Global Impact",
              description: "Democratizing access to expert-level skin cancer detection worldwide",
              gradient: "from-gray-500/20 to-blue-500/20"
            }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isCardsInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.8 + (index * 0.1) }}
              className={`p-8 rounded-2xl bg-gradient-to-br ${item.gradient} backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-500 group cursor-pointer relative overflow-hidden`}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

// Process Section with Advanced Scroll Animations
function ProcessSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  
  const { navigateWithLoading } = useNavigationLoading()
  
  const isSectionInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const isBackgroundInView = useInView(backgroundRef, { once: true, margin: "-200px" });
  const isContentInView = useInView(contentRef, { once: true, margin: "-150px" });
  const isCtaInView = useInView(ctaRef, { once: true, margin: "-200px" });
  
  const handleTryMIDAS = () => {
    navigateWithLoading('/login', 'Launching MIDAS Platform...', 800)
  }
  
  const handleLearnMore = () => {
    navigateWithLoading('/learn-more', 'Loading More Information...')
  }

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-screen relative w-full flex items-center justify-center py-20 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={isSectionInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Interactive Grid Pattern Background - appears first */}
      <motion.div
        ref={backgroundRef}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={isBackgroundInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.0, delay: 0.2 }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
        <InteractiveGridPattern
          width={30}
          height={30}
          squares={[80, 40]}
          className="opacity-30 dark:opacity-20 w-full h-full"
          squaresClassName="fill-gray-400/20 stroke-gray-400/40 hover:fill-primary/20 hover:stroke-primary/60 dark:fill-gray-600/20 dark:stroke-gray-600/40 dark:hover:fill-primary/30 dark:hover:stroke-primary/50"
        />
      </motion.div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Content description - appears after background */}
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isContentInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mb-20"
        >
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
            Your ideal diagnosis may exist across many
            approaches at MIDAS. Explore our AI to
            see which could be the next step in
            your healthcare journey.
          </p>
        </motion.div>

        {/* Main content - appears after description */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isContentInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center"
        >
          <h3 className="text-md uppercase tracking-wider text-muted-foreground mb-8">
            AI-Powered Analysis
          </h3>
          <h2 className="text-5xl md:text-6xl font-bold mb-16 leading-tight space-y-2">
            <span className="block text-7xl">Join people who share</span>
            <span className="block text-7xl">your passion and</span>
            <span className="block text-7xl">complement your</span>
            <span className="block text-7xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
              expertise.
            </span>
          </h2>

          {/* CTA buttons - appear last */}
          <motion.div
            ref={ctaRef}
            initial={{ opacity: 0, y: 20 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-6 justify-center max-w-lg mx-auto"
          >
            <Button
              size="lg"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
              onClick={handleTryMIDAS}
            >
              Try MIDAS
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
              onClick={handleLearnMore}
            >
              Learn More
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

// Final CTA Section
function FinalCTASection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  
  const { navigateWithLoading } = useNavigationLoading()
  
  const isSectionInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const isBackgroundInView = useInView(backgroundRef, { once: true, margin: "-150px" });
  const isContentInView = useInView(contentRef, { once: true, margin: "-200px" });
  const isButtonInView = useInView(buttonRef, { once: true, margin: "-250px" });
  const isBadgesInView = useInView(badgesRef, { once: true, margin: "-300px" });
  
  const handleStartFreeAnalysis = () => {
    navigateWithLoading('/login', 'Starting Your Free Analysis...', 800)
  }
  
  const handleContactUs = () => {
    navigateWithLoading('/contact', 'Loading Contact Information...')
  }

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-[60vh] flex items-center justify-center px-4 py-20 relative"
      initial={{ opacity: 0 }}
      animate={isSectionInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Background gradient - appears first */}
      <motion.div
        ref={backgroundRef}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={isBackgroundInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.0, delay: 0.2 }}
        className="absolute inset-0 bg-gradient-to-b from-background to-background/50 -z-10"
      />
      
      {/* Content - appears after background */}
      <motion.div
        ref={contentRef}
        initial={{ opacity: 0, y: 40 }}
        animate={isContentInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="text-center max-w-4xl mx-auto"
      >
        <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight">
          Ready to transform
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            healthcare with AI?
          </span>
        </h2>

        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Join the future of dermatological diagnosis. Start your journey with MIDAS today.
        </p>

        {/* Buttons - appear after content */}
        <motion.div
          ref={buttonRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isButtonInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-6 justify-center"
        >
          <Button
            size="lg"
            className="w-full sm:w-auto px-12 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            onClick={handleStartFreeAnalysis}
          >
            Start Free Analysis
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-12 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
            onClick={handleContactUs}
          >
            Contact Us
          </Button>
        </motion.div>

        {/* Badges - appear last */}
        <motion.div
          ref={badgesRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isBadgesInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-wrap items-center justify-center gap-8 mt-12 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>HIPAA Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>FDA Cleared</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>99.2% Accuracy</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

// MIDAS Healthcare Product Data for Hero Parallax
const midasProducts = [
  {
    title: "AI Skin Analysis Dashboard",
    link: "/demo",
    thumbnail: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Dermatology AI Platform",
    link: "/learn-more",
    thumbnail: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Medical Image Classification",
    link: "/docs",
    thumbnail: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Clinical Decision Support",
    link: "/aboutus",
    thumbnail: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Healthcare Analytics",
    link: "/contact",
    thumbnail: "https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "AI Diagnostic Interface",
    link: "/demo",
    thumbnail: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Skin Cancer Detection AI",
    link: "/learn-more",
    thumbnail: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Medical Research Platform",
    link: "/docs",
    thumbnail: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Healthcare Data Visualization",
    link: "/aboutus",
    thumbnail: "https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "AI-Powered Diagnostics",
    link: "/contact",
    thumbnail: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Telemedicine Solutions",
    link: "/demo",
    thumbnail: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Clinical AI Assistant",
    link: "/learn-more",
    thumbnail: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Medical AI Framework",
    link: "/docs",
    thumbnail: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Healthcare Innovation Hub",
    link: "/aboutus",
    thumbnail: "https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  },
  {
    title: "Smart Medical Imaging",
    link: "/contact",
    thumbnail: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  }
];

// Custom Header Component for MIDAS
const MIDASHeader = () => {
  const { navigateWithLoading } = useNavigationLoading()
  
  const handleStartAnalysis = () => {
    navigateWithLoading('/login', 'Preparing MIDAS Platform...', 800)
  }
  
  const handleLearnMore = () => {
    navigateWithLoading('/learn-more', 'Loading Information...')
  }
  
  return (
    <div className="max-w-7xl relative mx-auto py-20 md:py-40 px-4 w-full left-0 top-0">
      <BlurFade delay={0.2} duration={0.8}>
        <h1 className="text-4xl md:text-7xl font-bold dark:text-white text-foreground leading-tight">
          Advanced AI-Powered <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            Skin Cancer Detection
          </span>
        </h1>
      </BlurFade>
      
      <BlurFade delay={0.5} duration={0.8}>
        <p className="max-w-2xl text-base md:text-xl mt-8 dark:text-neutral-200 text-muted-foreground leading-relaxed">
          MIDAS leverages cutting-edge machine learning to provide accurate, fast, and reliable skin cancer
          classification. Trusted by healthcare professionals worldwide for early detection and precision diagnosis.
        </p>
      </BlurFade>
      
      <BlurFade delay={0.8} duration={0.8}>
        <div className="flex flex-col sm:flex-row gap-6 mt-12">
          <Button
            size="lg"
            className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            onClick={handleStartAnalysis}
          >
            Start Free Analysis
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border-2 hover:bg-muted/50 transition-all duration-300 transform hover:scale-105"
            onClick={handleLearnMore}
          >
            Learn More
          </Button>
        </div>
      </BlurFade>
      
      <BlurFade delay={1.1} duration={0.8}>
        <div className="flex flex-wrap items-center justify-start gap-8 mt-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>HIPAA Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>FDA Cleared</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>99.2% Accuracy</span>
          </div>
        </div>
      </BlurFade>
    </div>
  );
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const isBackgroundInView = useInView(backgroundRef, { once: true, margin: "0px" });
  const isHeroInView = useInView(heroRef, { once: true, margin: "-200px" });

  return (
    <>
      <div ref={containerRef} className="bg-background relative overflow-hidden">
        {/* Background Pattern - appears first */}
        <motion.div
          ref={backgroundRef}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={isBackgroundInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full -z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
        </motion.div>

        <main className="relative z-10">
          {/* Hero Parallax Section - appears after background */}
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 40 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
          >
            <HeroParallax 
              products={midasProducts} 
              header={<MIDASHeader />}
            />
          </motion.div>

          {/* Experience Section - Apple Style */}
          <ExperienceSection />

          {/* Process Section with Scroll Animations */}
          <ProcessSection />

          {/* Final CTA Section */}
          <FinalCTASection />
        </main>
      </div>
  
    </>

  );
};

