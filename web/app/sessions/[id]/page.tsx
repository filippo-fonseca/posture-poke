"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { AuthGuard } from "@/components/AuthGuard";
import { StatsRow } from "@/components/StatsRow";
import type { SessionDoc, ChartDataPoint, PunishmentMarker } from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/lib/theme";

export default function SessionDetailPage() {
  return (
    <AuthGuard>
      <SessionDetail />
    </AuthGuard>
  );
}

function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;

    const db = getFirebaseDb();
    getDoc(doc(db, "users", user.uid, "sessions", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSession({
          id: snap.id,
          ...data,
          startedAt: data.startedAt?.toMillis?.() ?? data.startedAt,
          endedAt: data.endedAt?.toMillis?.() ?? data.endedAt,
        } as SessionDoc);
      }
      setLoading(false);
    });
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-500">Session not found.</p>
      </div>
    );
  }

  const date = new Date(session.endedAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <button
              onClick={() => router.push("/sessions")}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Sessions
            </button>
            <h1 className="text-lg font-bold tracking-tight">{date}</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <StatsRow
            goodPct={session.goodPct}
            alertCount={session.alertCount}
            bestStreak={session.bestStreak}
            sessionDuration={session.durationSeconds}
          />

          <SessionChart
            chartData={session.chartData}
            punishmentMarkers={session.punishmentMarkers ?? []}
            slouchThreshold={session.slouchThreshold}
          />

          {session.punishmentMarkers && session.punishmentMarkers.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
                Punishments ({session.punishmentMarkers.length})
              </h3>
              <div className="space-y-1.5">
                {session.punishmentMarkers.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 w-12">
                      {m.time}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {m.type === "coach" ? "Coach clip" : "Fart sound"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SessionChart({
  chartData,
  punishmentMarkers,
  slouchThreshold,
}: {
  chartData: ChartDataPoint[];
  punishmentMarkers: PunishmentMarker[];
  slouchThreshold: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#71717a" : "#a1a1aa";

  const greenStop = `${(1 - slouchThreshold / 50) * 100}%`;
  const amberStop = `${(1 - Math.min(slouchThreshold + 15, 50) / 50) * 100}%`;

  // Build a set of punishment times for quick lookup
  const punishmentTimes = new Set(punishmentMarkers.map((m) => m.time));

  // Merge punishment info into chart data
  const enrichedData = chartData.map((point) => ({
    ...point,
    punishment: punishmentTimes.has(point.time) ? point.delta : null,
  }));

  const tickInterval = Math.max(1, Math.floor(chartData.length / 15));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No chart data for this session.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Session Deviation
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={enrichedData}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <defs>
            <linearGradient
              id="sessionFill"
              x1="0"
              y1="5"
              x2="0"
              y2="275"
              gradientUnits="userSpaceOnUse"
            >
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
            <linearGradient
              id="sessionStroke"
              x1="0"
              y1="5"
              x2="0"
              y2="275"
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
            strokeOpacity={0.5}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload?.length) {
                const d = payload[0].payload;
                const hasPunishment = d.punishment !== null;
                return (
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                    <p className="font-mono text-sm">
                      {d.delta.toFixed(1)}&deg; at {d.time}
                    </p>
                    {hasPunishment && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Punishment triggered
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />

          <Area
            type="monotone"
            dataKey="delta"
            stroke="url(#sessionStroke)"
            strokeWidth={1.5}
            fill="url(#sessionFill)"
            isAnimationActive={false}
          />

          {/* Punishment markers as red dots */}
          <Area
            type="monotone"
            dataKey="punishment"
            stroke="none"
            fill="none"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: { punishment: number | null };
              };
              if (payload.punishment === null) return <></>;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill="#ef4444"
                  stroke={isDark ? "#18181b" : "#ffffff"}
                  strokeWidth={2}
                />
              );
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
