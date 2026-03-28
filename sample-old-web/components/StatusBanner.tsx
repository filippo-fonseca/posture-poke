"use client";

import { motion } from "framer-motion";

interface StatusBannerProps {
  currentDelta: number;
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
  currentStreakDuration: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function StatusBanner({
  currentDelta,
  isSlouchingNow,
  currentSlouchDuration,
  currentStreakDuration,
}: StatusBannerProps) {
  const statusText = isSlouchingNow ? "Sit up straight" : "Perfect alignment";

  return (
    <motion.div
      layout
      className={`
        relative overflow-hidden rounded-xl border-l-[3px] p-6 transition-all duration-400
        ${
          isSlouchingNow
            ? "border-l-accent-red bg-accent-red-dim glow-red"
            : "border-l-accent-green bg-accent-green-dim glow-green"
        }
      `}
    >
      {/* Background gradient */}
      <div
        className={`
          absolute inset-0 opacity-30
          ${
            isSlouchingNow
              ? "bg-gradient-to-r from-accent-red/10 to-transparent"
              : "bg-gradient-to-r from-accent-green/10 to-transparent"
          }
        `}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {/* Status text */}
          <motion.h2
            key={statusText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-white sm:text-3xl"
          >
            {statusText}
          </motion.h2>

          {/* Duration */}
          <p className="text-sm text-text-secondary">
            {isSlouchingNow
              ? `slouching for ${formatDuration(currentSlouchDuration)}`
              : `in good posture for ${formatDuration(currentStreakDuration)}`}
          </p>
        </div>

        {/* Angle display */}
        <div className="text-right">
          <motion.span
            key={currentDelta}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className={`
              font-mono text-4xl font-medium sm:text-5xl
              ${isSlouchingNow ? "text-accent-red" : "text-accent-green"}
            `}
          >
            {currentDelta.toFixed(1)}°
          </motion.span>
          <p className="text-xs text-text-tertiary">off baseline</p>
        </div>
      </div>
    </motion.div>
  );
}
