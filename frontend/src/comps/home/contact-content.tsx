"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { ArrowRight, PlayCircle, Stethoscope } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DemoVideoTrigger } from "@/comps/home/demo-video-modal";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import {
  CONTACT_METHODS,
  OUTREACH_CARDS,
  RESPONSE_PROMISE,
  SUPPORT_OPTIONS,
} from "@/data/home/contact";

export default function ContactContent() {
  const heroRef = useRef<HTMLElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const methodsRef = useRef<HTMLDivElement>(null);
  const additionalRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  const isHeroInView = useInView(heroRef, VIEW_ONCE_HEADER);
  const isOptionsInView = useInView(optionsRef, VIEW_ONCE_SECTION);
  const isMethodsInView = useInView(methodsRef, VIEW_ONCE_SECTION);
  const isAdditionalInView = useInView(additionalRef, VIEW_ONCE_SECTION);
  const isFooterInView = useInView(footerRef, VIEW_ONCE_SECTION);

  return (
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
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-8">Get the help you need.</h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Give us a few details and we&apos;ll offer the best solution. Connect by phone, chat,
            email, and more.
          </p>
        </motion.div>
      </section>

      {/* Main Support Options */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div ref={optionsRef} className="grid md:grid-cols-3 gap-8 mb-20">
            {SUPPORT_OPTIONS.map(({ icon: Icon, title, description, action }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                animate={isOptionsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }}
                className="group"
              >
                <Card className="h-full bg-card border border-border hover:bg-muted/50 transition-all duration-300 cursor-pointer relative">
                  <CardContent className="p-8 text-center">
                    <div className="mb-6 flex justify-center">
                      <div className="p-4 rounded-2xl bg-foreground text-background group-hover:scale-110 transition-transform duration-300">
                        <Icon className="h-12 w-12" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">{title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
                    <Button
                      variant="ghost"
                      className="text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
                    >
                      {action}
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
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Choose how to connect</h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
                Our team is ready to help with technical questions, partnerships, or general
                inquiries.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CONTACT_METHODS.map(
                ({ icon: Icon, title, description, detail, action, primary }, index) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isMethodsInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                    className="group"
                  >
                    <Card
                      className={cn(
                        "h-full bg-card border border-border hover:bg-muted/50 transition-all duration-300 cursor-pointer relative",
                        primary && "ring-2 ring-primary/20"
                      )}
                    >
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <div className="p-3 rounded-xl bg-foreground text-background w-fit group-hover:scale-110 transition-transform duration-300">
                            <Icon className="h-8 w-8" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{title}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{description}</p>
                        <p className="text-foreground text-sm font-medium mb-4">{detail}</p>
                        <Button
                          size="sm"
                          variant={primary ? "default" : "outline"}
                          className="w-full"
                        >
                          {action}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              )}
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
            {OUTREACH_CARDS.map(({ icon: Icon, title, description, action }) => (
              <Card key={title} className="bg-card border border-border relative">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <Icon className="h-6 w-6 sm:h-8 sm:w-8 mr-3" />
                    <h3 className="text-lg sm:text-xl font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    {description}
                  </p>
                  <Button variant="outline" className="w-full text-sm sm:text-base">
                    {action}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            {/* Hand-written: its CTA is a modal trigger, not an inert button */}
            <Card className="bg-card border border-border relative">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center mb-4 sm:mb-6">
                  <PlayCircle className="h-6 w-6 sm:h-8 sm:w-8 mr-3" />
                  <h3 className="text-lg sm:text-xl font-semibold">Watch Demo</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                  See MIDAS AI in action with our comprehensive product demonstration. Learn how our
                  platform can transform your workflow.
                </p>
                <DemoVideoTrigger variant="outline" className="w-full text-sm sm:text-base">
                  Watch Demo Video
                  <PlayCircle className="h-4 w-4 ml-2" />
                </DemoVideoTrigger>
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
              {RESPONSE_PROMISE.map((promise) => (
                <div key={promise.title}>
                  <div className="font-semibold text-foreground mb-1">{promise.title}</div>
                  <div>{promise.description}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
