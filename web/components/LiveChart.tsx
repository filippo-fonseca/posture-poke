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
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings";

interface LiveChartProps {
  data: ChartDataPoint[];
}

export function LiveChart({ data }: LiveChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#71717a" : "#a1a1aa";
  const { slouchThreshold } = useSettings();

  // Gradient stops mapped to the Y-axis (0-50 domain, chart height 220, margins 5/5)
  const greenStop = `${(1 - slouchThreshold / 50) * 100}%`;
  const amberStop = `${(1 - Math.min(slouchThreshold + 15, 50) / 50) * 100}%`;

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="mb-3 text-zinc-300 dark:text-zinc-600"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 12h4l3-9 4 18 3-9h4"
          />
        </svg>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Waiting for data...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Deviation &mdash; Last 60 Seconds
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <defs>
            <linearGradient
              id="liveChartFill"
              x1="0"
              y1="5"
              x2="0"
              y2="215"
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0%"
                stopColor="#ef4444"
                stopOpacity={isDark ? 0.25 : 0.12}
              />
              <stop offset={greenStop} stopColor="#ef4444" stopOpacity={0.02} />
              <stop offset={greenStop} stopColor="#22c55e" stopOpacity={0.02} />
              <stop
                offset="100%"
                stopColor="#22c55e"
                stopOpacity={isDark ? 0.25 : 0.12}
              />
            </linearGradient>
            <linearGradient
              id="liveChartStroke"
              x1="0"
              y1="5"
              x2="0"
              y2="215"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset={amberStop} stopColor="#ef4444" />
              <stop offset={amberStop} stopColor="#f59e0b" />
              <stop offset={greenStop} stopColor="#f59e0b" />
              <stop offset={greenStop} stopColor="#22c55e" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: textColor, fontSize: 10 }}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, 50]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: textColor, fontSize: 10 }}
            tickFormatter={(v) => `${v}\u00B0`}
          />

          <ReferenceLine
            y={slouchThreshold}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload?.length) {
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                    <p className="font-mono text-sm">
                      {d.delta.toFixed(1)}&deg; at {d.time}
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
            stroke="url(#liveChartStroke)"
            strokeWidth={2}
            fill="url(#liveChartFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
