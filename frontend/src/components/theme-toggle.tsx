"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }
  
  const isDark = theme === 'dark'

  // Prevent flash of wrong theme during hydration
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed top-20 right-6 z-[10000] w-12 h-12 rounded-full shadow-lg backdrop-blur-sm opacity-50"
        disabled
      >
        <div className="h-5 w-5 animate-pulse bg-muted-foreground/20 rounded" />
        <span className="sr-only">Loading theme</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      size="icon"
      className={`fixed top-20 right-6 z-[10000] w-12 h-12 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ${
        isDark
          ? 'bg-white/20 hover:bg-white/30 border-white/30 text-white'
          : 'bg-black/20 hover:bg-black/30 border-black/30 text-black'
      }`}
    >
      <div className="relative h-5 w-5 flex items-center justify-center perspective-1000">
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? 'dark' : 'light'}
            initial={{ 
              rotateX: 90, 
              opacity: 0,
              scale: 0.8
            }}
            animate={{ 
              rotateX: 0, 
              opacity: 1,
              scale: 1
            }}
            exit={{ 
              rotateX: -90, 
              opacity: 0,
              scale: 0.8
            }}
            transition={{ 
              duration: 0.3, 
              ease: "easeInOut",
              type: "tween"
            }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {isDark ? (
              <Sun 
                className="h-5 w-5 transition-all duration-200" 
                strokeWidth={2}
              />
            ) : (
              <Moon 
                className="h-5 w-5 transition-all duration-200" 
                strokeWidth={2}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <span className="sr-only">
        Switch to {isDark ? 'light' : 'dark'} theme
      </span>
    </Button>
  );
}
