"use client";

import { motion } from "framer-motion";

interface StatsRowProps {
  goodPct: number;
  alertCount: number;
  bestStreak: number;
  sessionDuration: number;
}

function formatStreak(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatSession(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StatsRow({
  goodPct,
  alertCount,
  bestStreak,
  sessionDuration,
}: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Good Posture"
        value={`${goodPct}%`}
        color={goodPct >= 70 ? "green" : goodPct >= 50 ? "amber" : "red"}
      />
      <StatCard
        label="Alerts"
        value={alertCount.toString()}
        color={alertCount === 0 ? "green" : alertCount <= 3 ? "amber" : "red"}
      />
      <StatCard
        label="Best Streak"
        value={formatStreak(bestStreak)}
        color="green"
      />
      <StatCard
        label="Session Time"
        value={formatSession(sessionDuration)}
        color="neutral"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "neutral";
}) {
  const colorClasses = {
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    neutral: "text-zinc-900 dark:text-zinc-100",
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <motion.span
        key={value}
        initial={{ opacity: 0.5, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`font-mono text-2xl font-medium ${colorClasses[color]}`}
      >
        {value}
      </motion.span>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
