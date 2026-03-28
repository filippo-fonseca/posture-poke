"use client";

import { Header } from "@/components/Header";
import { StatusBanner } from "@/components/StatusBanner";
import { AngleGauge } from "@/components/AngleGauge";
import { LiveChart } from "@/components/LiveChart";
import { StatsRow } from "@/components/StatsRow";
import { HistoryChart } from "@/components/HistoryChart";
import { CoachTip } from "@/components/CoachTip";
import { usePostureSession } from "@/hooks/usePostureSession";
import { useVoiceAlert } from "@/hooks/useVoiceAlert";

export default function Home() {
  const session = usePostureSession();

  // Voice alerts
  useVoiceAlert({
    isSlouchingNow: session.isSlouchingNow,
    currentSlouchDuration: session.currentSlouchDuration,
  });

  return (
    <div className="min-h-screen">
      <Header
        isConnected={session.isConnected}
        sessionDuration={session.sessionDuration}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Hero Status Banner */}
          <StatusBanner
            currentDelta={session.currentDelta}
            isSlouchingNow={session.isSlouchingNow}
            currentSlouchDuration={session.currentSlouchDuration}
            currentStreakDuration={session.currentStreakDuration}
          />

          {/* Gauge + Live Chart Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <AngleGauge currentDelta={session.currentDelta} />
            </div>
            <div className="lg:col-span-2">
              <LiveChart data={session.liveChartData} />
            </div>
          </div>

          {/* Stats Row */}
          <StatsRow
            goodPct={session.goodPct}
            alertCount={session.alertCount}
            bestStreak={session.bestStreak}
            sessionDuration={session.sessionDuration}
          />

          {/* History Chart */}
          <HistoryChart data={session.minuteBuckets} />

          {/* Coach + Placeholder Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <CoachTip
              tip={session.currentTip}
              isFetching={session.isFetchingTip}
              onFetchNew={session.fetchTip}
            />

            {/* Placeholder for future features */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-card/50 p-6">
              <div className="text-center">
                <p className="text-sm text-text-tertiary">Coming soon</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Alert history & settings
                </p>
              </div>
            </div>
          </div>

          {/* Calibrate button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={session.calibrate}
              className="rounded-lg border border-border bg-bg-card px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-border-bright hover:text-white"
            >
              Recalibrate Baseline
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-text-tertiary">
            SpineSync — YHack 2026 Hardware Track
          </p>
        </div>
      </footer>
    </div>
  );
}
