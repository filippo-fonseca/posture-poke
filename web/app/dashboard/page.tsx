"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import {
  useSettings,
  STRICTNESS_LEVELS,
  HARSHNESS_LEVELS,
  type InstructionType,
} from "@/lib/settings";
import { Header } from "@/components/Header";
import { StatusBanner } from "@/components/StatusBanner";
import { AngleGauge } from "@/components/AngleGauge";
import { LiveChart } from "@/components/LiveChart";
import { StatsRow } from "@/components/StatsRow";
import { HistoryChart } from "@/components/HistoryChart";
import { AuthGuard } from "@/components/AuthGuard";
import { usePostureSession } from "@/hooks/usePostureSession";
import { useVoiceAlert } from "@/hooks/useVoiceAlert";
import { useCoaches } from "@/hooks/useCoaches";
import { useTheme } from "@/lib/theme";
import type {
  PunishmentMarker,
  CoachDoc,
  SessionDoc,
  ChartDataPoint,
} from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Dashboard shell ─────────────────────────────────────────────────────────

type ModalStep = null | "config" | "calibrate";

function DashboardContent() {
  const session = usePostureSession();
  const { user } = useAuth();
  const { settings, update, slouchThreshold } = useSettings();
  const punishmentMarkersRef = useRef<PunishmentMarker[]>([]);

  const [view, setView] = useState<"monitor" | "settings">("monitor");
  const [modalStep, setModalStep] = useState<ModalStep>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  // Past sessions list
  const [pastSessions, setPastSessions] = useState<SessionDoc[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = useCallback(() => {
    if (!user) return;
    setSessionsLoading(true);
    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", user.uid, "sessions"),
      orderBy("endedAt", "desc")
    );
    getDocs(q).then((snap) => {
      setPastSessions(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
              startedAt:
                d.data().startedAt?.toMillis?.() ?? d.data().startedAt,
              endedAt: d.data().endedAt?.toMillis?.() ?? d.data().endedAt,
            } as SessionDoc)
        )
      );
      setSessionsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handlePunishment = useCallback((marker: PunishmentMarker) => {
    punishmentMarkersRef.current.push(marker);
  }, []);

  useVoiceAlert({
    isSlouchingNow: session.isSlouchingNow,
    currentSlouchDuration: session.currentSlouchDuration,
    sessionDuration: session.sessionDuration,
    onPunishment: handlePunishment,
  });

  const handleStop = async () => {
    const markers = [...punishmentMarkersRef.current];
    const data = session.stopSession();
    punishmentMarkersRef.current = [];

    if (user && data.allChartData.length > 0) {
      const db = getFirebaseDb();
      await addDoc(collection(db, "users", user.uid, "sessions"), {
        startedAt: Timestamp.fromMillis(data.startTime),
        endedAt: Timestamp.now(),
        durationSeconds: data.sessionDuration,
        goodPct: data.goodPct,
        alertCount: data.alertCount,
        bestStreak: data.bestStreak,
        slouchThreshold,
        instructionType: settings.instructionType,
        coachId: settings.activeCoachId ?? null,
        chartData: data.allChartData,
        punishmentMarkers: markers,
      });
      fetchSessions();
    }
  };

  const handleConfigDone = (cfg: {
    strictness: number;
    harshness: number;
    instructionType: InstructionType;
    activeCoachId: string | null;
    coachAudioFiles: string[];
  }) => {
    update(cfg);
    setModalStep("calibrate");
  };

  const handleCalibrateDone = () => {
    session.calibrate();
    setModalStep(null);
    session.startSession();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isConnected={session.isConnected}
        sessionDuration={session.sessionDuration}
        onSettingsClick={() =>
          setView(view === "settings" ? "monitor" : "settings")
        }
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {view === "settings" ? (
          <SettingsPanel onBack={() => setView("monitor")} />
        ) : session.sessionState !== "idle" ? (
          <ActiveSessionView session={session} onStop={handleStop} />
        ) : (
          <IdleView
            isConnected={session.isConnected}
            onStart={() => setModalStep("config")}
            sessions={pastSessions}
            sessionsLoading={sessionsLoading}
            onSessionClick={setDetailSessionId}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6">
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          PosturePoke — YHack 2026 Hardware Track
        </p>
      </footer>

      {modalStep === "config" && (
        <ConfigModal
          isConnected={session.isConnected}
          defaults={settings}
          onNext={handleConfigDone}
          onCancel={() => setModalStep(null)}
        />
      )}
      {modalStep === "calibrate" && (
        <CalibrateModal
          currentDelta={session.currentDelta}
          onCalibrate={handleCalibrateDone}
          onBack={() => setModalStep("config")}
        />
      )}
      {detailSessionId && (
        <SessionDetailModal
          sessionId={detailSessionId}
          onClose={() => setDetailSessionId(null)}
        />
      )}
    </div>
  );
}

// ── Idle view (start button + past sessions) ────────────────────────────────

function IdleView({
  isConnected,
  onStart,
  sessions,
  sessionsLoading,
  onSessionClick,
}: {
  isConnected: boolean;
  onStart: () => void;
  sessions: SessionDoc[];
  sessionsLoading: boolean;
  onSessionClick: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex justify-center py-4">
        <button
          onClick={onStart}
          disabled={!isConnected}
          className="rounded-lg bg-emerald-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
        >
          {isConnected ? "Start Session" : "Waiting for sensor..."}
        </button>
      </div>

      <section>
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
          Past Sessions
        </h2>

        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-[72px] w-full rounded-lg" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="mb-3 text-zinc-300 dark:text-zinc-700"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No sessions yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => s.id && onSessionClick(s.id)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(s.endedAt)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {formatDuration(s.durationSeconds)} &middot;{" "}
                      {s.alertCount} alert{s.alertCount !== 1 ? "s" : ""}{" "}
                      &middot; {s.punishmentMarkers?.length ?? 0} punishment
                      {(s.punishmentMarkers?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-lg font-medium ${
                      s.goodPct >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : s.goodPct >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {s.goodPct}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Active session view ─────────────────────────────────────────────────────

function ActiveSessionView({
  session,
  onStop,
}: {
  session: ReturnType<typeof usePostureSession>;
  onStop: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3">
        {session.sessionState === "running" ? (
          <button
            onClick={session.pauseSession}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={session.resumeSession}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Resume
          </button>
        )}
        <button
          onClick={onStop}
          className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-5 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-950/40"
        >
          Stop Session
        </button>
      </div>

      <StatusBanner
        currentDelta={session.currentDelta}
        isSlouchingNow={session.isSlouchingNow}
        currentSlouchDuration={session.currentSlouchDuration}
        currentStreakDuration={session.currentStreakDuration}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AngleGauge currentDelta={session.currentDelta} />
        </div>
        <div className="lg:col-span-2">
          <LiveChart data={session.liveChartData} />
        </div>
      </div>

      <StatsRow
        goodPct={session.goodPct}
        alertCount={session.alertCount}
        bestStreak={session.bestStreak}
        sessionDuration={session.sessionDuration}
      />

      <HistoryChart
        recentData={session.recentChartData}
        minuteData={session.minuteBuckets}
      />
    </div>
  );
}

// ── Session detail modal ────────────────────────────────────────────────────

function SessionDetailModal({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    getDoc(doc(db, "users", user.uid, "sessions", sessionId)).then((snap) => {
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
  }, [user, sessionId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-bold">
            {loading ? (
              <span className="shimmer inline-block h-5 w-40 rounded" />
            ) : session ? (
              formatDate(session.endedAt)
            ) : (
              "Session not found"
            )}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="shimmer h-[76px] w-full rounded-lg"
                  />
                ))}
              </div>
              <div className="shimmer h-[300px] w-full rounded-lg" />
            </>
          ) : session ? (
            <>
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

              {session.punishmentMarkers &&
                session.punishmentMarkers.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
                      Punishments ({session.punishmentMarkers.length})
                    </h3>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
            </>
          ) : (
            <p className="text-sm text-zinc-500 py-8 text-center">
              Session not found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Session chart (used inside detail modal) ────────────────────────────────

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

  const punishmentTimes = new Set(punishmentMarkers.map((m) => m.time));
  const enrichedData = chartData.map((point) => ({
    ...point,
    punishment: punishmentTimes.has(point.time) ? point.delta : null,
  }));

  const tickInterval = Math.max(1, Math.floor(chartData.length / 15));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No chart data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
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
              <stop key="f0" offset="0%" stopColor="#ef4444" stopOpacity={isDark ? 0.2 : 0.1} />
              <stop key="f1" offset={greenStop} stopColor="#ef4444" stopOpacity={0.02} />
              <stop key="f2" offset={greenStop} stopColor="#22c55e" stopOpacity={0.02} />
              <stop key="f3" offset="100%" stopColor="#22c55e" stopOpacity={isDark ? 0.2 : 0.1} />
            </linearGradient>
            <linearGradient
              id="sessionStroke"
              x1="0"
              y1="5"
              x2="0"
              y2="275"
              gradientUnits="userSpaceOnUse"
            >
              <stop key="s0" offset="0%" stopColor="#ef4444" />
              <stop key="s1" offset={amberStop} stopColor="#ef4444" />
              <stop key="s2" offset={amberStop} stopColor="#f59e0b" />
              <stop key="s3" offset={greenStop} stopColor="#f59e0b" />
              <stop key="s4" offset={greenStop} stopColor="#22c55e" />
              <stop key="s5" offset="100%" stopColor="#22c55e" />
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

// ── Settings panel (coach management only) ──────────────────────────────────

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const {
    coaches,
    loading: coachesLoading,
    canCreate,
    createCoach,
    deleteCoach,
  } = useCoaches();
  const { settings } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!coachPrompt.trim() || !canCreate) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await createCoach(coachPrompt);
      setCoachPrompt("");
    } catch (err: unknown) {
      setGenerateError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-6"
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
        Back to monitoring
      </button>

      <h2 className="text-lg font-bold mb-1">Manage Coaches</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Create AI voice coaches that roast your posture. Select one when
        starting a session.
      </p>

      <div className="space-y-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {coaches.length}/5 coaches
        </p>

        {coachesLoading ? (
          <div className="space-y-2">
            <div className="shimmer h-16 w-full rounded-lg" />
            <div className="shimmer h-16 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-2">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className={`rounded-lg border p-3 flex items-center justify-between transition-colors ${
                  settings.activeCoachId === coach.id
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm truncate">{coach.description}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {coach.audioFiles.length} clips
                    {settings.activeCoachId === coach.id && (
                      <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                        Active
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => coach.id && deleteCoach(coach.id)}
                  className="rounded p-1.5 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                  aria-label="Delete coach"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {canCreate && (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Create New Coach
            </h3>
            <textarea
              value={coachPrompt}
              onChange={(e) => setCoachPrompt(e.target.value)}
              placeholder="e.g. A sarcastic Gordon Ramsay-like drill sergeant..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
              rows={2}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !coachPrompt.trim()}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {isGenerating ? "Generating..." : "Generate Coach"}
              </button>
              {isGenerating && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  This may take a minute...
                </span>
              )}
            </div>
            {generateError && (
              <p className="mt-2 text-xs text-red-500">{generateError}</p>
            )}
          </div>
        )}

        {!canCreate && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Maximum 5 coaches reached. Delete one to create a new one.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Config modal ────────────────────────────────────────────────────

function ConfigModal({
  isConnected,
  defaults,
  onNext,
  onCancel,
}: {
  isConnected: boolean;
  defaults: {
    strictness: number;
    harshness: number;
    instructionType: InstructionType;
    activeCoachId: string | null;
  };
  onNext: (cfg: {
    strictness: number;
    harshness: number;
    instructionType: InstructionType;
    activeCoachId: string | null;
    coachAudioFiles: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [strictness, setStrictness] = useState(defaults.strictness);
  const [harshness, setHarshness] = useState(defaults.harshness);
  const [instructionType, setInstructionType] = useState<InstructionType>(
    defaults.instructionType
  );
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(
    defaults.activeCoachId
  );
  const { coaches, loading: coachesLoading } = useCoaches();

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);
  const canProceed =
    isConnected &&
    (instructionType === "farts" ||
      (instructionType === "coach" && selectedCoach != null));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
        <h2 className="text-lg font-bold mb-1">New Session</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
          Configure your session parameters.
        </p>

        <div className="mb-5">
          <label className="text-sm font-medium mb-2 block">Strictness</label>
          <div className="grid grid-cols-5 gap-1.5">
            {STRICTNESS_LEVELS.map((level, i) => (
              <button
                key={level.name}
                onClick={() => setStrictness(i)}
                className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                  strictness === i
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <span className="block text-[10px] sm:text-[11px] font-medium leading-tight">
                  {level.name}
                </span>
                <span className="block text-[9px] sm:text-[10px] mt-0.5 opacity-60">
                  {level.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="text-sm font-medium mb-2 block">Harshness</label>
          <div className="grid grid-cols-5 gap-1.5">
            {HARSHNESS_LEVELS.map((level, i) => (
              <button
                key={level.name}
                onClick={() => setHarshness(i)}
                className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                  harshness === i
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <span className="block text-[10px] sm:text-[11px] font-medium leading-tight">
                  {level.name}
                </span>
                <span className="block text-[9px] sm:text-[10px] mt-0.5 opacity-60">
                  {level.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium">Punishment</label>
            <button
              type="button"
              onClick={() => setInstructionType(Math.random() < 0.5 ? "farts" : "coach")}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Randomize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setInstructionType("farts")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                instructionType === "farts"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span className="block text-sm font-medium">Fart Sounds</span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Embarrassing audio cues
              </span>
            </button>
            <button
              onClick={() => setInstructionType("coach")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                instructionType === "coach"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span className="block text-sm font-medium">Coach Voice</span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                AI roasts your posture
              </span>
            </button>
          </div>
        </div>

        {instructionType === "coach" && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Select Coach</label>
              {coaches.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const others = coaches.filter((c) => c.id !== selectedCoachId);
                    if (others.length > 0) {
                      setSelectedCoachId(others[Math.floor(Math.random() * others.length)].id ?? null);
                    }
                  }}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Random coach"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              )}
            </div>
            {coachesLoading ? (
              <div className="shimmer h-12 w-full rounded-lg" />
            ) : coaches.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3">
                No coaches yet. Create one from the settings panel (gear icon).
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {coaches.map((coach) => (
                  <button
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id ?? null)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      selectedCoachId === coach.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="block text-sm truncate">
                      {coach.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() =>
              onNext({
                strictness,
                harshness,
                instructionType,
                activeCoachId:
                  instructionType === "coach" ? selectedCoachId : null,
                coachAudioFiles:
                  instructionType === "coach" && selectedCoach
                    ? selectedCoach.audioFiles
                    : [],
              })
            }
            disabled={!canProceed}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {!isConnected ? "Sensor not connected" : "Next: Calibrate"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Calibrate modal ─────────────────────────────────────────────────

function CalibrateModal({
  currentDelta,
  onCalibrate,
  onBack,
}: {
  currentDelta: number;
  onCalibrate: () => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600 dark:text-emerald-400"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>

        <h2 className="text-lg font-bold mb-2">Sit up straight</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Sit in your best posture position, then press the button below. This
          sets your baseline for the session.
        </p>

        <p className="font-mono text-3xl font-medium text-zinc-900 dark:text-zinc-100 mb-6">
          {currentDelta.toFixed(1)}&deg;
        </p>

        <button
          onClick={onCalibrate}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Calibrate &amp; Start
        </button>
        <button
          onClick={onBack}
          className="mt-2 w-full rounded-lg py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Back
        </button>
      </div>
    </div>
  );
}
