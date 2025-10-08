"use client";

// import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from "react";
import "../globals.css";
import Header from "./header/page";
import Footer from "./footer/page";
import FiberWaves from "@/components/ui/shadcn-io/fiber-waves";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Note: metadata export needs to be moved to a separate file when using "use client"
// export const metadata: Metadata = {
//   title: "MIDAS intellisense dermatology app",
//   description: "Developers : Ajitkumar Senthil kumar & ManojMaheshwar Jagadeesan",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isDark, setIsDark] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
      setIsDark(true);
    } else {
      setIsDark(false);
    }
    setIsLoaded(true);
  }, []);

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  }, [isDark, isLoaded]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Prevent flash of wrong theme during hydration
  if (!isLoaded) {
    return null;
  }

  return (
    <html lang="en" className={isDark ? 'dark' : ''}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && systemDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`min-h-screen relative antialiased transition-colors duration-300 ${
        isDark ? 'bg-black text-white' : 'bg-white text-black'
      }`}>
        {/* Theme Toggle */}
        <Button
          onClick={toggleTheme}
          variant="outline"
          size="icon"
          className={`fixed top-18 right-6 z-[9999] w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${
            isDark
              ? 'bg-white/20 hover:bg-white/30 border-white/30 text-white'
              : 'bg-black/20 hover:bg-black/30 border-black/30 text-black'
          }`}
          style={{
            position: 'fixed',
            top: '5rem',
            right: '1.5rem',
            zIndex: 9999
          }}
        >
          {isDark ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Header />

        <main className="py-25">
          {children}
        </main>

        <Footer/>
      </body>

    </html>
  );
}
