"use client";

import { motion } from "framer-motion";

interface StatsRowProps {
  goodPct: number;
  alertCount: number;
  bestStreak: number;
  sessionDuration: number;
}

function formatStreak(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) {
    return `${m}m`;
  }
  return `${m}m ${s}s`;
}

function formatSession(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StatsRow({ goodPct, alertCount, bestStreak, sessionDuration }: StatsRowProps) {
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
        color="white"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "white";
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    green: "text-accent-green",
    amber: "text-accent-amber",
    red: "text-accent-red",
    white: "text-white",
  };

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <motion.span
        key={value}
        initial={{ opacity: 0.5, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`font-mono text-2xl font-medium ${colorClasses[color]}`}
      >
        {value}
      </motion.span>
      <p className="mt-1 text-xs text-text-secondary">{label}</p>
    </div>
  );
}
