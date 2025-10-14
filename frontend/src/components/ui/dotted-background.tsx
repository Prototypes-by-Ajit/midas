"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface DottedBackgroundProps {
  className?: string;
  dotSize?: number;
  dotSpacing?: number;
  dotColor?: string;
  animationDuration?: number;
  onAnimationComplete?: () => void;
}

export const DottedBackground: React.FC<DottedBackgroundProps> = ({
  className,
  dotSize = 2,
  dotSpacing = 30,
  dotColor = "rgb(156 163 175)", // Default to gray-400
  animationDuration = 4,
  onAnimationComplete,
}) => {
  const [animationStarted, setAnimationStarted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationStarted(true);
    }, 100); // Small delay to ensure proper mounting

    const completeTimer = setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, animationDuration * 1000); // Convert to milliseconds

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [animationDuration, onAnimationComplete]);
  return (
    <div
      className={cn(
        "absolute inset-0 w-full h-full overflow-hidden",
        className
      )}
    >
      {/* Unpack from center animation - dots pattern */}
      <div
        className={`absolute inset-0 w-full h-full transition-all duration-1000 ${
          animationStarted ? 'opacity-60 dark:opacity-40 scale-100' : 'opacity-0 scale-0'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize}px, transparent ${dotSize + 1}px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          transformOrigin: 'center center',
        }}
      />
      
      {/* Secondary layer - appears with delay */}
      <div
        className={`absolute inset-0 w-full h-full transition-all duration-1200 delay-500 ${
          animationStarted ? 'opacity-40 dark:opacity-25 scale-100' : 'opacity-0 scale-75'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize * 1.2}px, transparent ${(dotSize * 1.2) + 1}px)`,
          backgroundSize: `${dotSpacing * 1.3}px ${dotSpacing * 1.3}px`,
          transformOrigin: 'center center',
        }}
      />
      
      {/* Center expanding radius animation */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`transition-all duration-1000 ${
            animationStarted ? 'animate-expand-radius opacity-100' : 'opacity-0'
          }`}
          style={{
            animationDuration: `${animationDuration}s`,
            color: dotColor,
            animationDelay: '0.5s',
          }}
        />
      </div>
      
      {/* Continuous subtle animation after initial unpack */}
      {animationStarted && (
        <div
          className="absolute inset-0 w-full h-full animate-expand-dots opacity-20 dark:opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize * 0.8}px, transparent ${(dotSize * 0.8) + 1}px)`,
            backgroundSize: `${dotSpacing * 1.5}px ${dotSpacing * 1.5}px`,
            animationDuration: `${animationDuration * 2}s`,
            animationDelay: '2s',
          }}
        />
      )}
    </div>
  );
};

DottedBackground.displayName = "DottedBackground";