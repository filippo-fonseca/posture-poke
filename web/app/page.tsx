"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  deleteDoc,
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
import { SpineDecoration } from "@/components/SpineDecoration";
import { usePostureSession } from "@/hooks/usePostureSession";
import { useVoiceAlert } from "@/hooks/useVoiceAlert";
import { useCoaches } from "@/hooks/useCoaches";
import { useFriends } from "@/hooks/useFriends";
import {
  useFriendsLatestSessions,
  useFriendCoaches,
  useFriendSessions,
} from "@/hooks/useFriendData";
import { CoachPreviewButton } from "@/components/CoachPreviewButton";
import { COACH_IDEAS } from "@/lib/coach-ideas";
import { useTheme } from "@/lib/theme";
import type {
  PunishmentMarker,
  CoachDoc,
  SessionDoc,
  ChartDataPoint,
  FriendProfile,
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

type ModalStep = null | "config" | "calibrate" | "share";

function DashboardContent() {
  const session = usePostureSession();
  const { user } = useAuth();
  const { settings, update, slouchThreshold } = useSettings();
  const friendsData = useFriends();
  const friendsFeed = useFriendsLatestSessions(friendsData.friends);
  const punishmentMarkersRef = useRef<PunishmentMarker[]>([]);

  const [view, setView] = useState<"monitor" | "settings" | "friends">(
    "monitor",
  );
  const [modalStep, setModalStep] = useState<ModalStep>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [deleteSession, setDeleteSession] = useState<SessionDoc | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{
    goodPct: number;
    duration: number;
    alerts: number;
    bestStreak: number;
  } | null>(null);

  // Past sessions list
  const [pastSessions, setPastSessions] = useState<SessionDoc[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = useCallback(() => {
    if (!user) return;
    setSessionsLoading(true);
    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", user.uid, "sessions"),
      orderBy("endedAt", "desc"),
    );
    getDocs(q).then((snap) => {
      setPastSessions(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
              startedAt: d.data().startedAt?.toMillis?.() ?? d.data().startedAt,
              endedAt: d.data().endedAt?.toMillis?.() ?? d.data().endedAt,
            }) as SessionDoc,
        ),
      );
      setSessionsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Warn before closing/refreshing during an active session
  useEffect(() => {
    if (session.sessionState === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session.sessionState]);

  const handlePunishment = useCallback((marker: PunishmentMarker) => {
    punishmentMarkersRef.current.push(marker);
  }, []);

  const pokingRef = useRef(false);
  const handlePoke = useCallback(() => {
    if (pokingRef.current) return;
    pokingRef.current = true;
    session.sendCommand("SERVO:90");
    setTimeout(() => {
      session.sendCommand("SERVO:0");
      pokingRef.current = false;
    }, 1000);
  }, [session]);

  useVoiceAlert({
    isSlouchingNow: session.isSlouchingNow,
    currentSlouchDuration: session.currentSlouchDuration,
    sessionDuration: session.sessionDuration,
    sessionRunning: session.sessionState === "running",
    onPunishment: handlePunishment,
    onPoke: handlePoke,
  });

  const handleStop = async () => {
    const markers = [...punishmentMarkersRef.current];
    const data = session.stopSession();
    punishmentMarkersRef.current = [];

    setCompletedSummary({
      goodPct: data.goodPct,
      duration: data.sessionDuration,
      alerts: data.alertCount,
      bestStreak: data.bestStreak,
    });
    setModalStep("share");

    if (user && data.allChartData.length > 0) {
      const db = getFirebaseDb();
      await addDoc(collection(db, "users", user.uid, "sessions"), {
        startedAt: Timestamp.fromMillis(data.startTime),
        endedAt: Timestamp.now(),
        durationSeconds: data.sessionDuration,
        goodPct: data.goodPct,
        avgDeviation: data.avgDeviation,
        alertCount: data.alertCount,
        bestStreak: data.bestStreak,
        slouchThreshold,
        strictness: settings.strictness,
        harshness: settings.harshness,
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
    activeCoachOwnerUid: string | null;
    coachAudioFiles: string[];
    punishmentsEnabled: boolean;
    pokeEnabled: boolean;
    audioPunishments: import("@/lib/settings").AudioPunishment[];
  }) => {
    update(cfg);
    setModalStep("calibrate");
  };

  const handleCalibrate = () => {
    session.calibrate();
  };

  const handleStart = () => {
    setModalStep(null);
    session.startSession();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SpineDecoration
        sessionActive={session.sessionState === "running"}
        postureColor={
          session.currentDelta >= slouchThreshold + 15
            ? "#ef4444"
            : session.currentDelta >= slouchThreshold
              ? "#f59e0b"
              : "#22c55e"
        }
      />
      <Header
        onSettingsClick={() =>
          setView(view === "settings" ? "monitor" : "settings")
        }
        onFriendsClick={() =>
          setView(view === "friends" ? "monitor" : "friends")
        }
        hasPendingRequests={friendsData.pendingIncoming.length > 0}
        sessionActive={session.sessionState !== "idle"}
        onStopSession={() => session.stopSession()}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {view === "settings" ? (
          <SettingsPanel onBack={() => setView("monitor")} />
        ) : view === "friends" ? (
          <FriendsView onBack={() => setView("monitor")} />
        ) : session.sessionState !== "idle" ? (
          <ActiveSessionView session={session} onStop={handleStop} />
        ) : (
          <IdleView
            isConnected={session.isConnected}
            onStart={() => setModalStep("config")}
            onConnect={() => session.connectSerial()}
            sessions={pastSessions}
            sessionsLoading={sessionsLoading}
            onSessionClick={setDetailSessionId}
            onDeleteSession={setDeleteSession}
            friendsFeed={friendsFeed.data}
          />
        )}
      </main>

      <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-6">
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
          onCalibrate={handleCalibrate}
          onStart={handleStart}
          onBack={() => setModalStep("config")}
        />
      )}
      {modalStep === "share" && completedSummary && (
        <ShareModal
          summary={completedSummary}
          onClose={() => {
            setModalStep(null);
            setCompletedSummary(null);
          }}
        />
      )}
      {detailSessionId && (
        <SessionDetailModal
          sessionId={detailSessionId}
          onClose={() => setDetailSessionId(null)}
        />
      )}
      {deleteSession && (
        <DeleteSessionModal
          session={deleteSession}
          onConfirm={async () => {
            if (user && deleteSession.id) {
              const db = getFirebaseDb();
              await deleteDoc(doc(db, "users", user.uid, "sessions", deleteSession.id));
              fetchSessions();
            }
            setDeleteSession(null);
          }}
          onCancel={() => setDeleteSession(null)}
        />
      )}
    </div>
  );
}

function FriendFeedChart({
  uid,
  session: s,
}: {
  uid: string;
  session: SessionDoc;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const threshold = s.slouchThreshold ?? 20;
  const greenStop = `${(1 - threshold / 50) * 100}%`;
  const amberStop = `${(1 - Math.min(threshold + 15, 50) / 50) * 100}%`;

  return (
    <div className="mt-2 h-[50px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={s.chartData}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient
              id={`ff-f-${uid}`}
              x1="0"
              y1="0"
              x2="0"
              y2="50"
              gradientUnits="userSpaceOnUse"
            >
              <stop
                key="f0"
                offset="0%"
                stopColor="#ef4444"
                stopOpacity={isDark ? 0.2 : 0.1}
              />
              <stop
                key="f1"
                offset={greenStop}
                stopColor="#ef4444"
                stopOpacity={0.02}
              />
              <stop
                key="f2"
                offset={greenStop}
                stopColor="#22c55e"
                stopOpacity={0.02}
              />
              <stop
                key="f3"
                offset="100%"
                stopColor="#22c55e"
                stopOpacity={isDark ? 0.2 : 0.1}
              />
            </linearGradient>
            <linearGradient
              id={`ff-s-${uid}`}
              x1="0"
              y1="0"
              x2="0"
              y2="50"
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
          <Area
            type="monotone"
            dataKey="delta"
            stroke={`url(#ff-s-${uid})`}
            strokeWidth={1}
            fill={`url(#ff-f-${uid})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Idle view (start button + past sessions) ────────────────────────────────

function IdleView({
  isConnected,
  onStart,
  onConnect,
  sessions,
  sessionsLoading,
  onSessionClick,
  onDeleteSession,
  friendsFeed,
}: {
  isConnected: boolean;
  onStart: () => void;
  onConnect: () => void;
  sessions: SessionDoc[];
  sessionsLoading: boolean;
  onSessionClick: (id: string) => void;
  onDeleteSession: (s: SessionDoc) => void;
  friendsFeed: import("@/hooks/useFriendData").FriendLatestSession[];
}) {
  const lastSession = sessions.length > 0 ? sessions[0] : null;

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-3">
          Time for work? Watch your back.
        </h2>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Left: button + prompt */}
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-8">
            {isConnected ? (
              <button
                onClick={onStart}
                className="w-full rounded-lg bg-emerald-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Start Session
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="w-full rounded-lg bg-amber-500 dark:bg-amber-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 dark:hover:bg-amber-700"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 3v12" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 01-9 9" />
                  </svg>
                  Connect Sensor
                </span>
              </button>
            )}
            {lastSession && (
              <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Last session:{" "}
                <span
                  className={`font-mono font-medium ${
                    lastSession.goodPct >= 70
                      ? "text-emerald-600 dark:text-emerald-400"
                      : lastSession.goodPct >= 40
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {lastSession.goodPct}%
                </span>{" "}
                good posture
              </p>
            )}
          </div>

          {/* Right: last session mini chart + taunt */}
          {lastSession && lastSession.chartData?.length > 0 && (
            <MiniSessionChart session={lastSession} />
          )}
        </div>
      </div>

      {/* Friends feed */}
      {friendsFeed.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
            Friends&apos; Latest Sessions
          </h2>
          <div className="max-h-72 overflow-y-auto space-y-2 rounded-lg">
            {friendsFeed.map(({ friend, session: s }) => (
              <div
                key={friend.uid}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-3">
                  {friend.photoURL ? (
                    <img
                      src={friend.photoURL}
                      alt=""
                      className="h-7 w-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {friend.displayName}
                      </p>
                      <div className="text-right">
                        <span
                          className={`font-mono text-sm font-medium ${
                            s.goodPct >= 70
                              ? "text-emerald-600 dark:text-emerald-400"
                              : s.goodPct >= 40
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {s.goodPct}%
                        </span>
                        {s.avgDeviation != null && (
                          <p className="text-[10px] text-zinc-400 font-mono">
                            avg {s.avgDeviation.toFixed(1)}&deg;
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {formatDuration(s.durationSeconds)} &middot;{" "}
                      {formatDate(s.endedAt)}
                    </p>
                  </div>
                </div>
                {s.chartData?.length > 0 && (
                  <FriendFeedChart uid={friend.uid} session={s} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
            {sessions.map((s) => {
              const idx = s.strictness ?? 2;
              const strictnessBorder = [
                "border-b-emerald-300 border-r-emerald-300 dark:border-b-emerald-800 dark:border-r-emerald-800 hover:border-b-emerald-500 hover:border-r-emerald-500 dark:hover:border-b-emerald-500 dark:hover:border-r-emerald-500",
                "border-b-lime-300 border-r-lime-300 dark:border-b-lime-800 dark:border-r-lime-800 hover:border-b-lime-500 hover:border-r-lime-500 dark:hover:border-b-lime-500 dark:hover:border-r-lime-500",
                "border-b-amber-300 border-r-amber-300 dark:border-b-amber-800 dark:border-r-amber-800 hover:border-b-amber-500 hover:border-r-amber-500 dark:hover:border-b-amber-500 dark:hover:border-r-amber-500",
                "border-b-orange-300 border-r-orange-300 dark:border-b-orange-800 dark:border-r-orange-800 hover:border-b-orange-500 hover:border-r-orange-500 dark:hover:border-b-orange-500 dark:hover:border-r-orange-500",
                "border-b-red-300 border-r-red-300 dark:border-b-red-800 dark:border-r-red-800 hover:border-b-red-500 hover:border-r-red-500 dark:hover:border-b-red-500 dark:hover:border-r-red-500",
              ][idx] ?? "";

              return (
                <button
                  key={s.id}
                  onClick={() => s.id && onSessionClick(s.id)}
                  className={`group w-full rounded-lg border border-zinc-200 dark:border-zinc-800 border-b-2 border-r-2 ${strictnessBorder} bg-white dark:bg-zinc-900 p-4 text-left transition-colors overflow-hidden`}
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
                    <div className="flex items-center gap-2">
                      <div className="text-right transition-transform duration-200 group-hover:-translate-x-8">
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
                        {s.avgDeviation != null && (
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                            avg {s.avgDeviation.toFixed(1)}&deg;
                          </p>
                        )}
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s); }}
                        className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 rounded p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete session"
                        role="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniSessionChart({ session: s }: { session: SessionDoc }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const threshold = s.slouchThreshold ?? 20;
  const greenStop = `${(1 - threshold / 50) * 100}%`;
  const amberStop = `${(1 - Math.min(threshold + 15, 50) / 50) * 100}%`;

  return (
    <div className="flex-1 border-t sm:border-t-0 sm:border-l border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-center">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
        Can you do better than last time?
      </p>
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={s.chartData}
            margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
          >
            <defs>
              <linearGradient
                id={`idleMiniFill-${s.id ?? "0"}`}
                x1="0"
                y1="0"
                x2="0"
                y2="80"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  key="f0"
                  offset="0%"
                  stopColor="#ef4444"
                  stopOpacity={isDark ? 0.2 : 0.1}
                />
                <stop
                  key="f1"
                  offset={greenStop}
                  stopColor="#ef4444"
                  stopOpacity={0.02}
                />
                <stop
                  key="f2"
                  offset={greenStop}
                  stopColor="#22c55e"
                  stopOpacity={0.02}
                />
                <stop
                  key="f3"
                  offset="100%"
                  stopColor="#22c55e"
                  stopOpacity={isDark ? 0.2 : 0.1}
                />
              </linearGradient>
              <linearGradient
                id={`idleMiniStroke-${s.id ?? "0"}`}
                x1="0"
                y1="0"
                x2="0"
                y2="80"
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
            <Area
              type="monotone"
              dataKey="delta"
              stroke={`url(#idleMiniStroke-${s.id ?? "0"})`}
              strokeWidth={1.5}
              fill={`url(#idleMiniFill-${s.id ?? "0"})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 text-right">
        {formatDuration(s.durationSeconds)} &middot; {formatDate(s.endedAt)}
      </p>
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

      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-1 flex">
          <AngleGauge currentDelta={session.currentDelta} />
        </div>
        <div className="lg:col-span-2 flex">
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

// ── Share modal ─────────────────────────────────────────────────────────────

function ShareModal({
  summary,
  onClose,
}: {
  summary: {
    goodPct: number;
    duration: number;
    alerts: number;
    bestStreak: number;
  };
  onClose: () => void;
}) {
  const mins = Math.floor(summary.duration / 60);
  const secs = summary.duration % 60;
  const durationStr = `${mins}m ${secs}s`;

  const shareText = `I just completed a PosturePoke session! ${summary.goodPct}% good posture over ${durationStr}. Can you beat that? #PosturePoke`;
  const linkedInText = `I'm thrilled to announce that after ${durationStr} of relentless dedication, I have achieved a ${summary.goodPct}% good posture score. This wouldn't have been possible without my spine, my chair, and a small device that pokes me when I slouch. Grateful for the journey. #PosturePoke #OpenToWork #Posture #Wellness #Leadership`;
  const encodedText = encodeURIComponent(shareText);
  const encodedLinkedIn = encodeURIComponent(linkedInText);
  const url = encodeURIComponent("https://posturepoke.com");

  const pctColor =
    summary.goodPct >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : summary.goodPct >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const platforms = [
    {
      name: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${encodedLinkedIn}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodedText}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}%20${url}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
        <h2 className="text-lg font-bold mb-1 text-center">Session Complete</h2>

        <div className="my-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <span className={`font-mono text-2xl font-medium ${pctColor}`}>
              {summary.goodPct}%
            </span>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Good Posture
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <span className="font-mono text-2xl font-medium">
              {durationStr}
            </span>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Duration
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <span className="font-mono text-2xl font-medium">
              {summary.alerts}
            </span>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Alerts
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <span className="font-mono text-2xl font-medium">
              {Math.floor(summary.bestStreak / 60)}m {summary.bestStreak % 60}s
            </span>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Best Streak
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mb-3">
          Share your results
        </p>

        <div className="grid grid-cols-4 gap-2 mb-5">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-zinc-600 dark:text-zinc-400 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {p.icon}
              <span className="text-[9px]">{p.name}</span>
            </a>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Delete session modal ─────────────────────────────────────────────────────

function DeleteSessionModal({
  session,
  onConfirm,
  onCancel,
}: {
  session: SessionDoc;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isBad = session.goodPct < 60;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </div>
        <h3 className="text-sm font-bold mb-1">
          {isBad ? "Too ashamed of past performance?" : "Delete session"}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
          This action cannot be undone. The session data will be permanently removed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
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

  const strictnessLabel =
    session?.strictness != null
      ? (STRICTNESS_LEVELS[session.strictness]?.name ?? null)
      : null;
  const harshnessLabel =
    session?.harshness != null
      ? (HARSHNESS_LEVELS[session.harshness]?.name ?? null)
      : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-10">
      <div className="w-full max-w-3xl max-h-[calc(100vh-5rem)] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 shrink-0">
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

        {/* Body — scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {loading ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="shimmer h-[76px] w-full rounded-lg" />
                ))}
              </div>
              <div className="shimmer h-[300px] w-full rounded-lg" />
            </>
          ) : session ? (
            <>
              {/* Session parameters */}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  Threshold: {session.slouchThreshold}&deg;
                  {strictnessLabel && ` (${strictnessLabel})`}
                </span>
                {harshnessLabel && (
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                    Harshness: {harshnessLabel}
                  </span>
                )}
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  Punishment:{" "}
                  {session.instructionType === "coach" ? "Coach" : "Farts"}
                </span>
                {session.avgDeviation != null && (
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                    Avg deviation: {session.avgDeviation.toFixed(1)}&deg;
                  </span>
                )}
              </div>

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

  const punishmentMap = new Map(punishmentMarkers.map((m) => [m.time, m]));
  const enrichedData = chartData.map((point) => {
    const marker = punishmentMap.get(point.time);
    return {
      ...point,
      punishment: marker ? point.delta : null,
      punishmentType: marker?.type ?? null,
      poked: marker?.poked ?? false,
    };
  });

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
              <stop
                key="f0"
                offset="0%"
                stopColor="#ef4444"
                stopOpacity={isDark ? 0.2 : 0.1}
              />
              <stop
                key="f1"
                offset={greenStop}
                stopColor="#ef4444"
                stopOpacity={0.02}
              />
              <stop
                key="f2"
                offset={greenStop}
                stopColor="#22c55e"
                stopOpacity={0.02}
              />
              <stop
                key="f3"
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
                if (d.punishment === null) {
                  return (
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                      <p className="font-mono text-sm">
                        {d.delta.toFixed(1)}&deg; at {d.time}
                      </p>
                    </div>
                  );
                }
                const typeLabel =
                  d.punishmentType === "beep"
                    ? "Beep"
                    : d.punishmentType === "fart"
                      ? "Fart"
                      : "Coach";
                const label = d.poked ? `Poker + ${typeLabel}` : typeLabel;
                const color =
                  d.punishmentType === "beep"
                    ? "text-emerald-500"
                    : d.punishmentType === "fart"
                      ? "text-orange-500"
                      : "text-red-500";
                return (
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 shadow-sm">
                    <p className="font-mono text-sm">
                      {d.delta.toFixed(1)}&deg; at {d.time}
                    </p>
                    <p className={`text-xs mt-0.5 font-medium ${color}`}>
                      {label}
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
              const { cx, cy, index, payload } = props as {
                cx: number;
                cy: number;
                index: number;
                payload: {
                  punishment: number | null;
                  punishmentType: string | null;
                  poked: boolean;
                };
              };
              if (payload.punishment === null) return <g key={`pd-${index}`} />;
              const fillColor =
                payload.punishmentType === "beep"
                  ? "#22c55e"
                  : payload.punishmentType === "fart"
                    ? "#f97316"
                    : "#ef4444";
              const bg = isDark ? "#18181b" : "#ffffff";
              if (payload.poked) {
                const s = 7;
                return (
                  <polygon
                    key={`pd-${index}`}
                    points={`${cx},${cy - s} ${cx - s},${cy + s * 0.6} ${cx + s},${cy + s * 0.6}`}
                    fill={fillColor}
                    stroke={bg}
                    strokeWidth={2}
                  />
                );
              }
              return (
                <circle
                  key={`pd-${index}`}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={fillColor}
                  stroke={bg}
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

// ── Friends view ────────────────────────────────────────────────────────────

function FriendsView({ onBack }: { onBack: () => void }) {
  const {
    friends,
    pendingIncoming,
    pendingOutgoing,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriends();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    const err = await sendRequest(email);
    setSendResult(err ?? "Invite sent!");
    if (!err) setEmail("");
    setSending(false);
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
        Back
      </button>

      <h2 className="text-lg font-bold mb-1">Friends</h2>
      <p className="text-xs font-medium mb-6">More friends = more coaches</p>

      {/* Send invite */}
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Friend's email"
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={sending || !email.trim()}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40"
        >
          {sending ? "..." : "Send Invite"}
        </button>
      </div>
      {sendResult && (
        <p
          className={`text-xs mb-4 ${sendResult === "Invite sent!" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
        >
          {sendResult}
        </p>
      )}

      {/* Pending incoming */}
      {pendingIncoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Incoming Requests
          </h3>
          <div className="space-y-2">
            {pendingIncoming.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {req.profile.photoURL ? (
                    <img
                      src={req.profile.photoURL}
                      alt=""
                      className="h-6 w-6 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {req.profile.displayName}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {req.profile.email}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => acceptRequest(req.id)}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineRequest(req.id)}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending outgoing */}
      {pendingOutgoing.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Sent Requests
          </h3>
          <div className="space-y-2">
            {pendingOutgoing.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {req.profile.photoURL ? (
                    <img
                      src={req.profile.photoURL}
                      alt=""
                      className="h-6 w-6 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <p className="text-sm">{req.profile.displayName}</p>
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
        {loading
          ? "Loading..."
          : `${friends.length} friend${friends.length !== 1 ? "s" : ""}`}
      </h3>
      {friends.length === 0 && !loading && (
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
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No friends yet — send an invite above
          </p>
        </div>
      )}
      <div className="space-y-2">
        {friends.map((f) => (
          <FriendCard
            key={f.uid}
            friend={f}
            expanded={expandedFriend === f.uid}
            onToggle={() =>
              setExpandedFriend(expandedFriend === f.uid ? null : f.uid)
            }
            onRemove={() => removeFriend(f.uid)}
          />
        ))}
      </div>
    </div>
  );
}

function FriendCard({
  friend,
  expanded,
  onToggle,
  onRemove,
}: {
  friend: FriendProfile;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { sessions, loading: sessionsLoading } = useFriendSessions(
    expanded ? friend.uid : null,
  );
  const { coaches, loading: coachesLoading } = useFriendCoaches(
    expanded ? friend.uid : null,
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {friend.photoURL ? (
            <img
              src={friend.photoURL}
              alt=""
              className="h-7 w-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          )}
          <div>
            <p className="text-sm font-medium">{friend.displayName}</p>
            <p className="text-[10px] text-zinc-400">{friend.email}</p>
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-4">
          {/* Coaches */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Coaches
            </h4>
            {coachesLoading ? (
              <div className="shimmer h-10 w-full rounded-lg" />
            ) : coaches.length === 0 ? (
              <p className="text-xs text-zinc-400">No coaches</p>
            ) : (
              <div className="space-y-1">
                {coaches.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5"
                  >
                    <p className="text-xs truncate flex-1">{c.description}</p>
                    <CoachPreviewButton coach={c} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Sessions
            </h4>
            {sessionsLoading ? (
              <div className="shimmer h-10 w-full rounded-lg" />
            ) : sessions.length === 0 ? (
              <p className="text-xs text-zinc-400">No sessions</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5"
                  >
                    <div>
                      <p className="text-xs">{formatDate(s.endedAt)}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatDuration(s.durationSeconds)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono text-xs font-medium ${
                          s.goodPct >= 70
                            ? "text-emerald-600 dark:text-emerald-400"
                            : s.goodPct >= 40
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {s.goodPct}%
                      </span>
                      {s.avgDeviation != null && (
                        <p className="text-[9px] text-zinc-400 font-mono">
                          avg {s.avgDeviation.toFixed(1)}&deg;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            Remove friend
          </button>
        </div>
      )}
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
        err instanceof Error ? err.message : "Something went wrong",
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
        Back
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
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm truncate">{coach.description}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {coach.audioFiles.length} clips
                  </p>
                </div>
                <CoachPreviewButton coach={coach} />
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
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Create New Coach
              </h3>
              {!coachPrompt.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    setCoachPrompt(
                      COACH_IDEAS[
                        Math.floor(Math.random() * COACH_IDEAS.length)
                      ],
                    )
                  }
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Random coach idea"
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
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle
                      cx="8"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="8"
                      cy="16"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                </button>
              )}
            </div>
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
    activeCoachOwnerUid: string | null;
    coachAudioFiles: string[];
    punishmentsEnabled: boolean;
    pokeEnabled: boolean;
    audioPunishments: import("@/lib/settings").AudioPunishment[];
  }) => void;
  onCancel: () => void;
}) {
  const DIFFICULTY_COLORS = [
    "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    "border-lime-500 bg-lime-50 dark:bg-lime-950/30 text-lime-700 dark:text-lime-400",
    "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400",
    "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
  ];

  type SessionMode = "punishments" | "scared";
  type AudioType = "beep" | "farts" | "coach";

  const [mode, setMode] = useState<SessionMode>("punishments");
  const [strictness, setStrictness] = useState(defaults.strictness);
  const [harshness, setHarshness] = useState(defaults.harshness);
  const [pokeEnabled, setPokeEnabled] = useState(false);
  const [audioTypes, setAudioTypes] = useState<Set<AudioType>>(
    new Set(["farts"]),
  );
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(
    defaults.activeCoachId,
  );
  const [selectedCoachOwnerUid, setSelectedCoachOwnerUid] = useState<
    string | null
  >(null);

  const { coaches, loading: coachesLoading } = useCoaches();
  const { friends } = useFriends();

  // Load friend coaches
  const [friendCoaches, setFriendCoaches] = useState<
    { friend: FriendProfile; coaches: CoachDoc[] }[]
  >([]);
  useEffect(() => {
    if (friends.length === 0) {
      setFriendCoaches([]);
      return;
    }
    const db = getFirebaseDb();
    Promise.all(
      friends.map(async (f) => {
        try {
          const q = query(
            collection(db, "users", f.uid, "coaches"),
            orderBy("createdAt", "desc"),
          );
          const snap = await getDocs(q);
          const fCoaches = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as CoachDoc,
          );
          return fCoaches.length > 0 ? { friend: f, coaches: fCoaches } : null;
        } catch {
          return null;
        }
      }),
    ).then((results) =>
      setFriendCoaches(
        results.filter(
          (r): r is { friend: FriendProfile; coaches: CoachDoc[] } =>
            r !== null,
        ),
      ),
    );
  }, [friends]);

  const allCoaches = [
    ...coaches.map((c) => ({ ...c, ownerUid: null as string | null })),
    ...friendCoaches.flatMap(({ friend, coaches: fc }) =>
      fc.map((c) => ({ ...c, ownerUid: friend.uid })),
    ),
  ];
  const selectedCoach = allCoaches.find((c) => c.id === selectedCoachId);

  const toggleAudio = (type: AudioType) => {
    setAudioTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const hasAnyPunishment = pokeEnabled || audioTypes.size > 0;
  const needsCoach = audioTypes.has("coach") && !selectedCoach;
  const canProceed =
    isConnected && (mode === "scared" || (hasAnyPunishment && !needsCoach));

  const handleNext = () => {
    if (mode === "scared") {
      onNext({
        strictness,
        harshness: 0,
        instructionType: "farts",
        activeCoachId: null,
        activeCoachOwnerUid: null,
        coachAudioFiles: [],
        punishmentsEnabled: false,
        pokeEnabled: false,
        audioPunishments: [],
      });
      return;
    }
    // Determine instructionType for backwards compat
    const audioPunishments = Array.from(audioTypes);
    const instructionType: InstructionType = audioTypes.has("coach")
      ? "coach"
      : "farts";
    onNext({
      strictness,
      harshness,
      instructionType,
      activeCoachId: audioTypes.has("coach") ? selectedCoachId : null,
      activeCoachOwnerUid: audioTypes.has("coach")
        ? selectedCoachOwnerUid
        : null,
      coachAudioFiles:
        audioTypes.has("coach") && selectedCoach
          ? selectedCoach.audioFiles
          : [],
      punishmentsEnabled: true,
      pokeEnabled,
      audioPunishments,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8">
      <div className="w-full max-w-lg max-h-[calc(100vh-4rem)] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
        <div className="p-6 pb-0 shrink-0">
          <h2 className="text-lg font-bold mb-1">New Session</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Configure your session parameters.
          </p>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={() => setMode("punishments")}
              className={`rounded-lg border p-3 text-center transition-colors ${
                mode === "punishments"
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span className="block text-sm font-medium">Punishments</span>
            </button>
            <button
              onClick={() => setMode("scared")}
              className={`rounded-lg border p-3 text-center transition-colors ${
                mode === "scared"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span className="block text-sm font-medium">I&apos;m scared</span>
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto">
          {mode === "scared" ? (
            <div className="py-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Strictness
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {STRICTNESS_LEVELS.map((level, i) => (
                    <button
                      key={level.name}
                      onClick={() => setStrictness(i)}
                      className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                        strictness === i
                          ? DIFFICULTY_COLORS[i]
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
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
                  No punishments, but we still track your posture. Strictness
                  sets what counts as slouching.
                </p>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center mt-6">
                Can&apos;t take punishments righ now? You&apos;d better have a
                good excuse. &ldquo;I&apos;m in the library&#34; doesn&apos;t
                count.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <label className="text-sm font-medium mb-2 block">
                  Strictness
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {STRICTNESS_LEVELS.map((level, i) => (
                    <button
                      key={level.name}
                      onClick={() => setStrictness(i)}
                      className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                        strictness === i
                          ? DIFFICULTY_COLORS[i]
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
                <label className="text-sm font-medium mb-2 block">
                  Harshness
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {HARSHNESS_LEVELS.map((level, i) => (
                    <button
                      key={level.name}
                      onClick={() => setHarshness(i)}
                      className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                        harshness === i
                          ? DIFFICULTY_COLORS[i]
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

              {/* Poke toggle */}
              <div className="mb-5">
                <button
                  onClick={() => setPokeEnabled(!pokeEnabled)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    pokeEnabled
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <span
                    className={`block text-sm font-medium ${pokeEnabled ? "text-red-700 dark:text-red-400" : ""}`}
                  >
                    The Poker
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Servo-powered poke when you slouch
                  </span>
                </button>
              </div>

              {/* Audio punishments */}
              <div className="mb-5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 block uppercase tracking-wide">
                  Audio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => toggleAudio("beep")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      audioTypes.has("beep")
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="block text-sm font-medium">Beep</span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Simple tone
                    </span>
                  </button>
                  <button
                    onClick={() => toggleAudio("farts")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      audioTypes.has("farts")
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="block text-sm font-medium">Farts</span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Embarrassing
                    </span>
                  </button>
                  <button
                    onClick={() => toggleAudio("coach")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      audioTypes.has("coach")
                        ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="block text-sm font-medium">Coach</span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      AI roasts you
                    </span>
                  </button>
                </div>
              </div>

              {/* Coach selection (only if coach audio selected) */}
              {audioTypes.has("coach") && (
                <div className="mb-5">
                  <label className="text-sm font-medium mb-2 block">
                    Select Coach
                  </label>
                  {coachesLoading ? (
                    <div className="shimmer h-12 w-full rounded-lg" />
                  ) : allCoaches.length === 0 ? (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3">
                      No coaches yet. Create one from the settings panel.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {coaches.length > 0 && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wide">
                          Your Coaches
                        </p>
                      )}
                      {coaches.map((coach) => (
                        <div key={coach.id} className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedCoachId(coach.id ?? null);
                              setSelectedCoachOwnerUid(null);
                            }}
                            className={`flex-1 rounded-lg border p-2.5 text-left transition-colors ${
                              selectedCoachId === coach.id
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                            }`}
                          >
                            <span className="block text-sm leading-snug">
                              {coach.description}
                            </span>
                          </button>
                          <CoachPreviewButton coach={coach} />
                        </div>
                      ))}
                      {friendCoaches.map(({ friend, coaches: fc }) => (
                        <div key={friend.uid}>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wide mt-2">
                            {friend.displayName}&apos;s Coaches
                          </p>
                          {fc.map((coach) => (
                            <div
                              key={coach.id}
                              className="flex items-center gap-1 mt-1.5"
                            >
                              <button
                                onClick={() => {
                                  setSelectedCoachId(coach.id ?? null);
                                  setSelectedCoachOwnerUid(friend.uid);
                                }}
                                className={`flex-1 rounded-lg border p-2.5 text-left transition-colors ${
                                  selectedCoachId === coach.id
                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                                }`}
                              >
                                <span className="block text-sm leading-snug">
                                  {coach.description}
                                </span>
                              </button>
                              <CoachPreviewButton coach={coach} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-6 pt-2 shrink-0">
          <button
            onClick={handleNext}
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
  onStart,
  onBack,
}: {
  currentDelta: number;
  onCalibrate: () => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const [calibrated, setCalibrated] = useState(false);

  const handleCalibrate = () => {
    onCalibrate();
    setCalibrated(true);
  };

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
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Sit in your best posture, then calibrate. This zeros out the angle so
          your current position becomes 0&deg;.
        </p>

        <p className="font-mono text-3xl font-medium text-zinc-900 dark:text-zinc-100 mb-1">
          {currentDelta.toFixed(1)}&deg;
        </p>
        {calibrated && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4">
            Baseline set — angle zeroed
          </p>
        )}
        {!calibrated && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
            current reading
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCalibrate}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {calibrated ? "Recalibrate" : "Calibrate"}
          </button>
          <button
            onClick={onStart}
            disabled={!calibrated}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            Start Session
          </button>
        </div>
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
