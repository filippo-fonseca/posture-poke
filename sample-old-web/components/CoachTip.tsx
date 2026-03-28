"use client";

import { motion, AnimatePresence } from "framer-motion";

interface CoachTipProps {
  tip: string;
  isFetching: boolean;
  onFetchNew: () => void;
}

export function CoachTip({ tip, isFetching, onFetchNew }: CoachTipProps) {
  return (
    <div className="rounded-xl border border-border border-l-accent-amber border-l-[3px] bg-bg-card p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="text-accent-amber"
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wider text-accent-amber">
          AI Coach
        </span>
      </div>

      {/* Tip content */}
      <AnimatePresence mode="wait">
        {isFetching ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="shimmer h-4 w-full rounded" />
            <div className="shimmer h-4 w-3/4 rounded" />
          </motion.div>
        ) : (
          <motion.p
            key={tip}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-base leading-relaxed text-white"
          >
            {tip}
          </motion.p>
        )}
      </AnimatePresence>

      {/* New tip button */}
      <button
        onClick={onFetchNew}
        disabled={isFetching}
        className="mt-4 text-sm text-text-secondary transition-colors hover:text-accent-amber disabled:opacity-50"
      >
        New tip &rarr;
      </button>
    </div>
  );
}
