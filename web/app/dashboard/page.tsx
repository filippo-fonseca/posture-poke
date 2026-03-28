"use client";

import { useRef, useCallback } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { Header } from "@/components/Header";
import { StatusBanner } from "@/components/StatusBanner";
import { AngleGauge } from "@/components/AngleGauge";
import { LiveChart } from "@/components/LiveChart";
import { StatsRow } from "@/components/StatsRow";
import { HistoryChart } from "@/components/HistoryChart";
import { AuthGuard } from "@/components/AuthGuard";
import { usePostureSession } from "@/hooks/usePostureSession";
import { useVoiceAlert } from "@/hooks/useVoiceAlert";
import type { PunishmentMarker } from "@/lib/types";

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const session = usePostureSession();
  const { user } = useAuth();
  const { settings, slouchThreshold } = useSettings();
  const punishmentMarkersRef = useRef<PunishmentMarker[]>([]);

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
        punishmentMarkers: [...punishmentMarkersRef.current],
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isConnected={session.isConnected}
        sessionDuration={session.sessionDuration}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Session controls */}
          {session.sessionState === "idle" && (
            <div className="flex justify-center">
              <button
                onClick={session.startSession}
                disabled={!session.isConnected}
                className="rounded-lg bg-emerald-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
              >
                {session.isConnected
                  ? "Start Session"
                  : "Waiting for sensor..."}
              </button>
            </div>
          )}

          {session.sessionState !== "idle" && (
            <>
              {/* Pause / Resume / Stop bar */}
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
                  onClick={handleStop}
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
                  <AngleGauge
                    currentDelta={session.currentDelta}
                    onCalibrate={session.calibrate}
                  />
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
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6">
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          PosturePoke — YHack 2026 Hardware Track
        </p>
      </footer>
    </div>
  );
}
