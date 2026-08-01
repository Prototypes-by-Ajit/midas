"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "motion/react";
import { ExternalLink } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import HeroOrb from "@/components/effects/hero-orb";
import { VIEW_ONCE_HEADER, VIEW_ONCE_SECTION } from "@/motion/viewport";
import { GOVERNANCE_CARDS, TEAM, TECH } from "@/data/home/aboutus";

const HERO_BADGES = [
  "Research-driven",
  "Artifical Intelligence",
  "Machine Learning",
  "Security-Privacy",
];

/** Shared hover lift used by the team and governance cards. */
const HOVER_LIFT = { y: -4, scale: 1.01 } as const;
const HOVER_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

export default function AboutUsContent() {
  const heroRef = useRef<HTMLElement>(null);
  const missionRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLElement>(null);
  const governanceRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const isHeroInView = useInView(heroRef, VIEW_ONCE_HEADER);
  const isMissionInView = useInView(missionRef, VIEW_ONCE_SECTION);
  const isTeamInView = useInView(teamRef, VIEW_ONCE_SECTION);
  const isStackInView = useInView(stackRef, VIEW_ONCE_SECTION);
  const isGovernanceInView = useInView(governanceRef, VIEW_ONCE_SECTION);
  const isCtaInView = useInView(ctaRef, VIEW_ONCE_SECTION);

  return (
    <>
      {/* Hero */}
      <section ref={heroRef} className="container mx-auto px-4 py-12 md:py-35 relative">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={isHeroInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0 }}
            className="w-full h-full"
          >
            <HeroOrb />
          </motion.div>
        </div>

        {/* Content overlay */}
        <div className="mx-auto max-w-4xl text-center space-y-6 relative z-10 min-h-[60vh] flex flex-col justify-center">
          <motion.h1
            className="text-3xl md:text-7xl font-extrabold tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0 }}
          >
            We Bring AI with Innovation to Application and Products.
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-lg md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            We&apos;re a small research-driven team from the University at Buffalo exploring how
            modern AI can responsibly support clinicians. Our work sits at the intersection of
            machine learning, human factors, and healthcare workflows. We care about rigor, safety,
            and clarity—shipping ideas only when they&apos;re understandable and verifiable.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-2xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {HERO_BADGES.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-xs sm:text-sm">
                {badge}
              </Badge>
            ))}
          </motion.div>
        </div>
      </section>

      <Separator className="container mx-auto" />

      {/* What we do */}
      <section
        ref={missionRef}
        className="container mx-auto px-4 py-12 md:py-18 grid lg:grid-cols-2 gap-8 items-center"
      >
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, x: -30 }}
          animate={isMissionInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-2xl md:text-5xl font-bold space-y-4">Mission in MIDAS</h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            MIDAS (Multimodel Intelligent Dermatology Analysis System) was built on an Idea, where
            blending AI&apos;s neurals to the Deep Neural thinking on Analysis Aspect trained to
            perfection
          </p>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            At MIDAS, our mission is to empower healthcare professionals with trustworthy,
            multimodal AI tools that enhance clinical decision-making in dermatology. By combining
            dermoscopic imaging with patient metadata, we deliver insights that are not only
            accurate but also contextually informed — helping clinicians detect and classify skin
            conditions with confidence and clarity.
          </p>
        </motion.div>

        <motion.div
          className="relative py-10 aspect-[16/11] w-full rounded-2xl border bg-muted overflow-hidden"
          initial={{ opacity: 0, x: 30 }}
          animate={isMissionInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Replace with real product image or diagram */}
          <Image
            src="/midas-demo.png"
            alt="MIDAS decision support"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </motion.div>
      </section>

      {/* Team */}
      <section ref={teamRef} className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={isTeamInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Our Team
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isTeamInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            People who turn research into reliable software
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-6xl w-full mx-auto">
          {TEAM.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isTeamInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 + index * 0.2 }}
            >
              <motion.div whileHover={HOVER_LIFT} transition={HOVER_SPRING}>
                <Card className="group relative overflow-hidden border hover:shadow-lg transition-all duration-300">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar className="h-20 w-20 border-2 border-muted">
                        <AvatarImage src={member.avatar} className="object-cover" />
                        <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                          {member.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-tight mb-1">{member.name}</h3>
                        <p className="text-sm text-muted-foreground font-medium">{member.role}</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {member.bio}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {member.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 transition-colors"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      {member.links.map((link) => (
                        <Button
                          key={link.label}
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                        >
                          <a href={link.href} target="_blank" rel="noreferrer">
                            {link.label} <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Engineering Stack */}
      <section ref={stackRef} className="container mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={isStackInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Engineering Stack
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isStackInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Modern technologies powering our AI solutions
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isStackInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <Card className="group relative overflow-hidden border hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-muted-foreground">Live Technologies</span>
              </div>

              {/* Scrolling container */}
              <div className="relative overflow-hidden rounded-lg bg-muted/30 p-6">
                <div className="flex overflow-hidden">
                  <motion.div
                    className="flex gap-3 whitespace-nowrap"
                    animate={{ x: [0, -1600] }}
                    transition={{
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 20,
                        ease: "linear",
                      },
                    }}
                  >
                    {TECH.concat(TECH, TECH).map((tech, index) => (
                      <Badge
                        key={`${tech}-${index}`}
                        variant="secondary"
                        className="text-sm px-4 py-2 bg-background hover:bg-muted transition-colors flex-shrink-0 font-medium shadow-sm"
                      >
                        {tech}
                      </Badge>
                    ))}
                  </motion.div>
                </div>

                {/* Fade gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none z-10" />
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4 mt-8 text-center">
                <div>
                  <div className="text-xl font-bold mb-1">{TECH.length}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Technologies
                  </div>
                </div>
                <div className="border-x border-muted">
                  <div className="text-xl font-bold mb-1">100%</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Open Source
                  </div>
                </div>
                <div>
                  <div className="text-xl font-bold mb-1">24/7</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Monitoring
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Governance & Quality */}
      <section ref={governanceRef} className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={isGovernanceInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Governance &amp; Quality
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isGovernanceInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Our commitment to excellence through structured processes and ethical AI practices
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {GOVERNANCE_CARDS.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isGovernanceInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 + index * 0.15 }}
            >
              <motion.div whileHover={HOVER_LIFT} transition={HOVER_SPRING}>
                <Card className="group relative overflow-hidden border hover:shadow-lg transition-all duration-300 h-full">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                        {card.emoji}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{card.title}</h3>
                        <p className="text-sm text-muted-foreground font-medium">{card.subtitle}</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {card.description}
                    </p>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Key Features
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {card.features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-primary rounded-full" />
                            <span className="text-xs text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-muted">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Status</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-muted-foreground">Active</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section ref={ctaRef} className="border-t bg-muted/40">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="grid gap-6 md:grid-cols-2 items-center mb-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isCtaInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold">Collaborate with us</h3>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mt-2">
                Interested in research partnerships, Building-AI applications, Talk-Tech, clinical
                pilots, or security reviews? We&apos;d love to talk.
              </p>
            </motion.div>
            <motion.div
              className="flex md:justify-end gap-3"
              initial={{ opacity: 0, x: 30 }}
              animate={isCtaInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Button asChild variant="outline">
                <a href="/docs">Read the Docs</a>
              </Button>
              <Button asChild>
                <a href="/contact">Contact Us</a>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
