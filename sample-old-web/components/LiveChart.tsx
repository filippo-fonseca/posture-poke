"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartDataPoint } from "@/lib/types";
import { SLOUCH_THRESHOLD } from "@/lib/constants";

interface LiveChartProps {
  data: ChartDataPoint[];
}

export function LiveChart({ data }: LiveChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[250px] flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-6">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="mb-3 text-text-tertiary"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <p className="text-sm text-text-tertiary">Waiting for data...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Live Posture — Last 60 Seconds
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDelta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="40%" stopColor="#00ff88" stopOpacity={0.1} />
              <stop offset="40%" stopColor="#ef4444" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="strokeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" />
              <stop offset="40%" stopColor="#00ff88" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8888aa", fontSize: 10 }}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, 50]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8888aa", fontSize: 10 }}
            tickFormatter={(value) => `${value}°`}
          />

          <ReferenceLine
            y={SLOUCH_THRESHOLD}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-bg-card px-3 py-2">
                    <p className="font-mono text-sm text-white">
                      {data.delta.toFixed(1)}° at {data.time}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />

          <Area
            type="monotone"
            dataKey="delta"
            stroke="url(#strokeGradient)"
            strokeWidth={2}
            fill="url(#colorDelta)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
