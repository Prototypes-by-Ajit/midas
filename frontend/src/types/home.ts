import type { LucideIcon } from "lucide-react";

/**
 * Shared shapes for the `src/data/home/*` content modules.
 *
 * Rule: `icon` is always a Lucide component *reference*, never a rendered
 * element. Data modules stay plain `.ts`, and the consuming client section
 * decides the size — `{SECTIONS.map(({ icon: Icon }) => <Icon className="h-6 w-6" />)}`.
 * See `src/components/footer.tsx` for the same pattern already in use.
 */

/** Card whose visual is a Lucide icon. */
export interface IconCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * IconCard plus a bulleted body. Collapses five previously-identical shapes
 * that differed only in key name: PRIVACY_SECTIONS.content,
 * TERMS_SECTIONS.content, TECHNOLOGY_FEATURES.details, USE_CASES.benefits
 * and DASHBOARD_FEATURES.features.
 */
export interface IconCardWithItems extends IconCard {
  items: string[];
}

/** Plain title + blurb, no visual. */
export interface TitledNote {
  title: string;
  description: string;
}

/** Headline figure with a caption. */
export interface StatItem {
  number: string;
  label: string;
  description: string;
}

/** Governance card. Uses an emoji rather than a Lucide icon by design. */
export interface GovernanceCard {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
}

export interface TeamLink {
  label: string;
  href: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  /** Public-directory path, e.g. "/ajit.jpg". */
  avatar: string;
  tags: string[];
  links: TeamLink[];
}

/** Card in the landing hero parallax. Structurally matches HeroParallax's prop. */
export interface HeroProduct {
  title: string;
  link: string;
  thumbnail: string;
}

/** Landing "experience" pillar; `gradient` is a Tailwind gradient fragment. */
export interface ExperiencePillar {
  title: string;
  description: string;
  gradient: string;
}

export interface SupportOption {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  href: string;
}

export interface ContactMethod {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
  action: string;
  primary: boolean;
}

/** Outreach card with an inert CTA. */
export interface OutreachCard {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
}

export interface QuickStartStep {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
}

export interface ApiEndpoint {
  method: string;
  /** Plain string — braces are literal, e.g. "/api/v1/results/{id}". */
  path: string;
  title: string;
  description: string;
  parameters: string;
  response: string;
}
