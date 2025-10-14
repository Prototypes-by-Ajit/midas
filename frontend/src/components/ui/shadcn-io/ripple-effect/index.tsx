'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface RippleEffectProps {
  className?: string;
  rippleColor?: string;
  rippleCount?: number;
  rippleSize?: number;
  duration?: number;
}

export function RippleEffect({
  className = "",
  rippleColor = "rgba(255, 255, 255, 0.1)",
  rippleCount = 3,
  rippleSize = 300,
  duration = 4,
}: RippleEffectProps) {
  const ripples = Array.from({ length: rippleCount });

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {ripples.map((_, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full border opacity-30"
          style={{
            borderColor: rippleColor,
            borderWidth: '1px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{
            width: 0,
            height: 0,
            opacity: 1,
          }}
          animate={{
            width: rippleSize,
            height: rippleSize,
            opacity: 0,
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            delay: index * (duration / rippleCount),
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export default RippleEffect;