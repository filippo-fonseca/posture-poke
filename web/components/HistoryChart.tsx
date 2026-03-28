"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartDataPoint, MinuteBucket } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings";

interface HistoryChartProps {
  recentData: ChartDataPoint[];
  minuteData: MinuteBucket[];
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        className="mb-3 text-zinc-300 dark:text-zinc-600"
      >
        <path
          d="M3 3v18h18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M7 14l4-4 4 4 4-6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        Session history will appear here
      </p>
    </div>
  );
}

function RecentChart({ data }: { data: ChartDataPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#71717a" : "#a1a1aa";
  const { slouchThreshold } = useSettings();
  const tickInterval = Math.max(1, Math.floor(data.length / 10));

  const greenStop = `${(1 - slouchThreshold / 50) * 100}%`;
  const amberStop = `${(1 - Math.min(slouchThreshold + 15, 50) / 50) * 100}%`;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent Activity
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          Last {Math.min(10, Math.ceil(data.length / 60))} min
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="historyFill" x1="0" y1="5" x2="0" y2="195" gradientUnits="userSpaceOnUse">
              <stop
                offset="0%"
                stopColor="#ef4444"
                stopOpacity={isDark ? 0.2 : 0.1}
              />
              <stop offset={greenStop} stopColor="#ef4444" stopOpacity={0.02} />
              <stop offset={greenStop} stopColor="#22c55e" stopOpacity={0.02} />
              <stop
                offset="100%"
                stopColor="#22c55e"
                stopOpacity={isDark ? 0.2 : 0.1}
              />
            </linearGradient>
            <linearGradient id="historyStroke" x1="0" y1="5" x2="0" y2="195" gradientUnits="userSpaceOnUse">
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
            interval={tickInterval}
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
            strokeOpacity={0.4}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload?.length) {
                const d = payload[0].payload;
                const bad = d.delta > slouchThreshold;
                return (
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                    <p className="font-mono text-sm">
                      <span
                        className={
                          bad ? "text-red-500" : "text-emerald-500"
                        }
                      >
                        {d.delta.toFixed(1)}&deg;
                      </span>{" "}
                      at {d.time}
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
            stroke="url(#historyStroke)"
            strokeWidth={1.5}
            fill="url(#historyFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SessionOverview({ data }: { data: MinuteBucket[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#71717a" : "#a1a1aa";

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#22c55e";
    if (pct >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Session Overview
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {data.length} minute{data.length !== 1 ? "s" : ""}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: textColor, fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: textColor, fontSize: 10 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload?.length) {
                const d = payload[0].payload as MinuteBucket;
                const color =
                  d.goodPct >= 80
                    ? "text-emerald-500"
                    : d.goodPct >= 50
                      ? "text-amber-500"
                      : "text-red-500";
                return (
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                    <p className="text-sm">
                      {d.label}:{" "}
                      <span className={color}>{d.goodPct}%</span> good
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {d.totalReadings} readings
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="goodPct" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={getBarColor(entry.goodPct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryChart({ recentData, minuteData }: HistoryChartProps) {
  if (recentData.length === 0 && minuteData.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      {recentData.length > 0 && <RecentChart data={recentData} />}
      {minuteData.length > 0 && <SessionOverview data={minuteData} />}
    </div>
  );
}
