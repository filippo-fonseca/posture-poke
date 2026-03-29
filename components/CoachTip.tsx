"use client";

import { motion, AnimatePresence } from "framer-motion";

interface CoachTipProps {
  tip: string;
  isFetching: boolean;
  onFetchNew: () => void;
}

export function CoachTip({ tip, isFetching, onFetchNew }: CoachTipProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 border-l-[3px] border-l-amber-500 bg-white dark:bg-zinc-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-amber-500"
        >
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          AI Coach
        </span>
      </div>

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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-base leading-relaxed"
          >
            {tip}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={onFetchNew}
        disabled={isFetching}
        className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 transition-colors hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-40"
      >
        New tip &rarr;
      </button>
    </div>
  );
}
