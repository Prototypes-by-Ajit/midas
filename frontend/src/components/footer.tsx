import Link from 'next/link';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Twitter,
  Linkedin,
  Github,
  Facebook,
  Instagram,
  Stethoscope
} from 'lucide-react';

export default function Footer() {
  const footerLinks = [
    { name: 'Docs', href: '/docs' },
    { name: 'Blog', href: '/learn-more' },
    { name: 'About us', href: '/aboutus' },
    { name: 'Contact', href: '/contact' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' }
  ];

  const socialLinks = [
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Instagram, href: '#', label: 'Instagram' }
  ];

  return (
    <footer className="border-t border-border/40 bg-background mt-32">
      <div className="container mx-auto px-6 py-16">
        <BlurFade delay={0.2} duration={0.8}>
          {/* Logo Section */}
          <div className="flex justify-center mb-12">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-foreground text-background rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Stethoscope className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold text-foreground">MIDAS</span>
            </Link>
          </div>
        </BlurFade>

        <BlurFade delay={0.4} duration={0.8}>
          {/* Navigation Links */}
          <div className="flex flex-wrap justify-center gap-8 mb-16">
            {footerLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors duration-300 text-base font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </BlurFade>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-12" />

        <BlurFade delay={0.6} duration={0.8}>
          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            {/* Copyright */}
            <div className="text-muted-foreground text-sm">
              © MIDAS Medical AI
            </div>

            {/* Social Links */}
            <div className="flex items-center space-x-6">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <Link
                    key={social.label}
                    href={social.href}
                    className="text-muted-foreground hover:text-foreground transition-colors duration-300 p-2 hover:bg-muted/50 rounded-lg"
                    aria-label={social.label}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>
          </div>
        </BlurFade>
      </div>
    </footer>
  );
}
