'use client';

import React, { forwardRef } from "react";
import { cn } from '@/lib/utils';

export interface OrbProps extends React.HTMLAttributes<HTMLDivElement> {
  hue?: number;
  hoverIntensity?: number;
  rotateOnHover?: boolean;
  forceHoverState?: boolean;
}

export const OrbFallback = forwardRef<HTMLDivElement, OrbProps>(({
  className,
  hue = 0,
  hoverIntensity = 0.2,
  rotateOnHover = true,
  forceHoverState = false,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "w-full h-full relative overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-pink-500/20 animate-pulse" 
        style={{ animationDuration: "4s" }} 
      />
      
      {/* Rotating orb layers */}
      <div className="absolute inset-0 rounded-full">
        {/* Main spinning gradient */}
        <div 
          className="absolute inset-0 bg-gradient-radial from-blue-400/30 via-purple-400/15 to-transparent animate-spin"
          style={{ 
            animationDuration: "20s",
            filter: `hue-rotate(${hue}deg)`,
          }} 
        />
        
        {/* Counter-rotating conic gradient */}
        <div 
          className="absolute inset-0 bg-gradient-conic from-transparent via-blue-400/10 to-transparent animate-spin"
          style={{ 
            animationDuration: "15s", 
            animationDirection: "reverse",
            filter: `hue-rotate(${hue}deg)`,
          }} 
        />
        
        {/* Inner pulsing core */}
        <div className="absolute inset-1/4 bg-gradient-radial from-white/10 to-transparent animate-ping"
          style={{ animationDuration: "3s" }}
        />
      </div>
      
      {/* Hover state enhancement */}
      {(forceHoverState || rotateOnHover) && (
        <div 
          className="absolute inset-0 bg-gradient-radial from-blue-300/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" 
          style={{ 
            '--hover-opacity': forceHoverState ? hoverIntensity : undefined 
          } as React.CSSProperties}
        />
      )}
      
      {/* Additional animated layers for depth */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-gradient-to-t from-transparent via-blue-300/5 to-transparent animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "1s" }}
        />
        <div 
          className="absolute inset-0 bg-gradient-to-l from-transparent via-purple-300/5 to-transparent animate-pulse"
          style={{ animationDuration: "8s", animationDelay: "2s" }}
        />
      </div>
    </div>
  );
});

OrbFallback.displayName = 'OrbFallback';

export default OrbFallback;