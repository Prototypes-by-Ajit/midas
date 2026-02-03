'use client';

export const dynamic = "force-dynamic"
export const revalidate = 0


import React, { useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { DotPattern } from '@/components/ui/dot-pattern';
import { cn } from '@/lib/utils';
import {
  User,
  Laptop,
  Clock,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  ArrowRight,
  Stethoscope,
  Building2,
  Users,
  PlayCircle,
  X
} from 'lucide-react';
import { default as dynamicImport } from 'next/dynamic';
import Link from 'next/link';
const DotPattern = dynamicImport(() => import("@/components/ui/dot-pattern").then((mod) => ({ default: mod.DotPattern })),
{ 
  ssr: false,
  loading: () => null // Optional: loading component
}
);
export default function Contact() {
  // Demo modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const demoVideoUrl = ""; // Add your demo video URL here (YouTube embed, Vimeo, etc.)

  // Refs for sections
  const heroRef = useRef<HTMLElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const methodsRef = useRef<HTMLDivElement>(null);
  const additionalRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  // useInView hooks
  const isHeroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const isOptionsInView = useInView(optionsRef, { once: true, margin: "-150px" });
  const isMethodsInView = useInView(methodsRef, { once: true, margin: "-150px" });
  const isAdditionalInView = useInView(additionalRef, { once: true, margin: "-150px" });
  const isFooterInView = useInView(footerRef, { once: true, margin: "-150px" });

  const supportOptions = [
    {
      icon: <User className="h-12 w-12" />,
      title: "View your account",
      description: "Sign in with your MIDAS Account for personalized support and to see your analysis history.",
      action: "Sign in",
      href: "/login"
    },
    {
      icon: <Laptop className="h-12 w-12" />,
      title: "See all services",
      description: "You can also get started by choosing a service and finding your specific needs.",
      action: "Choose a service",
      href: "/docs"
    },
    {
      icon: <Clock className="h-12 w-12" />,
      title: "View support activity",
      description: "View your recent or upcoming consultations, support tickets, and communications.",
      action: "View activity",
      href: "#"
    }
  ];

  const contactMethods = [
    {
      icon: <Mail className="h-8 w-8" />,
      title: "Email Support",
      description: "Get help via email",
      detail: "Response within 24 hours",
      action: "Send Email",
      primary: true
    },
    {
      icon: <Phone className="h-8 w-8" />,
      title: "Phone Consultation", 
      description: "Speak with our team",
      detail: "Schedule a 30-min call",
      action: "Call Now",
      primary: false
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Demo Session",
      description: "See MIDAS AI in action",
      detail: "Live product demonstration",
      action: "Book Demo",
      primary: false
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "Live Chat",
      description: "Chat with support team",
      detail: "Available Mon-Fri 9AM-6PM",
      action: "Start Chat",
      primary: false
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 overflow-hidden">
        <DotPattern
          width={24}
          height={24}
          cx={3}
          cy={2}
          cr={3}
          glow={true}
          className="opacity-70 dark:opacity-70 text-foreground/20"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section ref={heroRef} className="py-20 px-4">
          <motion.div 
            className="container mx-auto max-w-4xl text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Stethoscope className="h-4 w-4 mr-2" />
              Get Support
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-8">
              Get the help you need.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Give us a few details and we&apos;ll offer the best solution. 
              Connect by phone, chat, email, and more.
            </p>
          </motion.div>
        </section>

        {/* Main Support Options */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div ref={optionsRef} className="grid md:grid-cols-3 gap-8 mb-20">
              {supportOptions.map((option, index) => (
                <motion.div
                  key={option.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isOptionsInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + (index * 0.2) }}
                  className="group"
                >
                  <Card className="h-full bg-card border border-border hover:bg-muted/50 transition-all duration-300 cursor-pointer relative">
                    <CardContent className="p-8 text-center">
                      <div className="mb-6 flex justify-center">
                        <div className="p-4 rounded-2xl bg-foreground text-background group-hover:scale-110 transition-transform duration-300">
                          {option.icon}
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold mb-4">{option.title}</h3>
                      <p className="text-muted-foreground mb-6 leading-relaxed">
                        {option.description}
                      </p>
                      <Button 
                        variant="ghost" 
                        className="text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
                      >
                        {option.action}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Contact Methods Grid */}
            <div ref={methodsRef} className="mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isMethodsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl font-bold mb-4">Choose how to connect</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Our team is ready to help with technical questions, partnerships, or general inquiries.
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {contactMethods.map((method, index) => (
                  <motion.div
                    key={method.title}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isMethodsInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + (index * 0.1) }}
                    className="group"
                  >
                    <Card className={cn(
                      "h-full bg-card border border-border hover:bg-muted/50 transition-all duration-300 cursor-pointer relative",
                      method.primary && "ring-2 ring-primary/20"
                    )}>
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <div className="p-3 rounded-xl bg-foreground text-background w-fit group-hover:scale-110 transition-transform duration-300">
                            {method.icon}
                          </div>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{method.title}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{method.description}</p>
                        <p className="text-foreground text-sm font-medium mb-4">{method.detail}</p>
                        <Button 
                          size="sm" 
                          variant={method.primary ? "default" : "outline"}
                          className="w-full"
                        >
                          {method.action}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Additional Support Info */}
            <motion.div
              ref={additionalRef}
              initial={{ opacity: 0, y: 30 }}
              animate={isAdditionalInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid md:grid-cols-3 gap-8"
            >
              <Card className="bg-card border border-border relative">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <Building2 className="h-6 w-6 sm:h-8 sm:w-8 mr-3" />
                    <h3 className="text-lg sm:text-xl font-semibold">Enterprise Solutions</h3>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    Custom AI solutions for hospitals, clinics, and healthcare organizations.
                    Get dedicated support and implementation assistance.
                  </p>
                  <Button variant="outline" className="w-full text-sm sm:text-base">
                    Contact Enterprise Team
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border relative">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 mr-3" />
                    <h3 className="text-lg sm:text-xl font-semibold">Research Partnerships</h3>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    Collaborate with our research team on cutting-edge AI projects.
                    Perfect for academic institutions and research organizations.
                  </p>
                  <Button variant="outline" className="w-full text-sm sm:text-base">
                    Explore Partnerships
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border relative">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <PlayCircle className="h-6 w-6 sm:h-8 sm:w-8 mr-3" />
                    <h3 className="text-lg sm:text-xl font-semibold">Watch Demo</h3>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    See MIDAS AI in action with our comprehensive product demonstration.
                    Learn how our platform can transform your workflow.
                  </p>
                  <Button
                    onClick={() => setShowDemoModal(true)}
                    variant="outline"
                    className="w-full text-sm sm:text-base"
                  >
                    Watch Demo Video
                    <PlayCircle className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Footer Info */}
        <section ref={footerRef} className="border-t border-border">
          <div className="container mx-auto max-w-4xl px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isFooterInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <h3 className="text-2xl font-semibold mb-4">Quick Response Promise</h3>
              <div className="grid md:grid-cols-3 gap-8 text-sm text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground mb-1">Email Support</div>
                  <div>Within 24 hours</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">Phone Support</div>
                  <div>Mon-Fri, 9AM-6PM EST</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">Emergency Support</div>
                  <div>24/7 for enterprise customers</div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      {/* Demo Video Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-5xl max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="absolute -top-10 sm:-top-12 right-0 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDemoModal(false)}
                className="text-white hover:bg-white/10 rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>

            {/* Modal Content */}
            <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 overflow-hidden">
              <CardContent className="p-0">
                {demoVideoUrl ? (
                  // Show iframe if demo URL is available
                  <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      src={demoVideoUrl}
                      className="absolute top-0 left-0 w-full h-full"
                      title="MIDAS Demo Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  // Show fallback message if no demo URL
                  <div className="flex flex-col items-center justify-center p-8 sm:p-12 md:p-16 lg:p-24 text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mb-6 sm:mb-8">
                      <PlayCircle className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-black dark:text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-black dark:text-white">
                      Demo Posting Soon
                    </h3>
                    <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-md mb-6 sm:mb-8 px-4">
                      We're preparing an exciting demo video to showcase MIDAS in action. Check back soon!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0">
                      <Button
                        onClick={() => setShowDemoModal(false)}
                        className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 w-full sm:w-auto"
                      >
                        Close
                      </Button>
                      <Link href="/contact" className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black w-full"
                        >
                          Request a Live Demo
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
