"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Apply theme to body/html
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-black', 'text-white');
      document.body.classList.remove('bg-white', 'text-black');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('bg-white', 'text-black');
      document.body.classList.remove('bg-black', 'text-white');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      size="icon"
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
          : 'bg-black/10 hover:bg-black/20 border-black/20 text-black'
      }`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}