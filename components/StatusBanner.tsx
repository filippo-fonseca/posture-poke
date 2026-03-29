"use client";

import { motion } from "framer-motion";

interface StatusBannerProps {
  currentDelta: number;
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
  currentStreakDuration: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
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
    <div
      className={`rounded-lg border-l-[3px] p-5 transition-colors duration-300 ${
        isSlouchingNow
          ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
          : "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <motion.h2
            key={statusText}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-semibold sm:text-2xl"
          >
            {statusText}
          </motion.h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isSlouchingNow
              ? `slouching for ${formatDuration(currentSlouchDuration)}`
              : `in good posture for ${formatDuration(currentStreakDuration)}`}
          </p>
        </div>

        <div className="text-right">
          <motion.span
            key={currentDelta}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className={`font-mono text-3xl font-medium sm:text-4xl ${
              isSlouchingNow
                ? "text-red-500"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {currentDelta.toFixed(1)}&deg;
          </motion.span>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            off baseline
          </p>
        </div>
      </div>
    </div>
  );
}
