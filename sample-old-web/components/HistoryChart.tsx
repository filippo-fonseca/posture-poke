"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MinuteBucket } from "@/lib/types";

interface HistoryChartProps {
  data: MinuteBucket[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-6">
        {/* Spine icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          className="mb-3 text-text-tertiary"
        >
          <path
            d="M12 2v2m0 4v2m0 4v2m0 4v2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-center text-sm text-text-tertiary">
          Start a session to see your posture history
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Each bar shows your posture quality per minute
        </p>
      </div>
    );
  }

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#00ff88";
    if (pct >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Posture History by Minute
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8888aa", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8888aa", fontSize: 10 }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as MinuteBucket;
                return (
                  <div className="rounded-lg border border-border bg-bg-card px-3 py-2">
                    <p className="text-sm text-white">
                      Minute {data.label}: <strong>{data.goodPct}%</strong> good posture
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {data.totalReadings} readings
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="goodPct" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.goodPct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
