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

  useVoiceAlert({
    isSlouchingNow: session.isSlouchingNow,
    currentSlouchDuration: session.currentSlouchDuration,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isConnected={session.isConnected}
        sessionDuration={session.sessionDuration}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
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

          <CoachTip
            tip={session.currentTip}
            isFetching={session.isFetchingTip}
            onFetchNew={session.fetchTip}
          />
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6">
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          SpineSync — YHack 2026 Hardware Track
        </p>
      </footer>
    </div>
  );
}
