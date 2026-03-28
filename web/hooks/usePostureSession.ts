"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSerial } from "./useSerial";
import {
  ChartDataPoint,
  MinuteBucket,
  PostureSession,
  SessionSaveData,
  SessionState,
} from "@/lib/types";
import {
  DEFAULT_TIP,
  CHART_HISTORY_SECONDS,
  RECENT_HISTORY_SECONDS,
  TIP_TRIGGER_DURATION,
} from "@/lib/constants";
import { useSettings } from "@/lib/settings";

export function usePostureSession(): PostureSession {
  const serial = useSerial();
  const { slouchThreshold } = useSettings();

  // Session state machine
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Posture state
  const [isSlouchingNow, setIsSlouchingNow] = useState(false);
  const [currentSlouchDuration, setCurrentSlouchDuration] = useState(0);
  const [currentStreakDuration, setCurrentStreakDuration] = useState(0);

  // Stats
  const [goodReadings, setGoodReadings] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // Chart data
  const allSessionDataRef = useRef<ChartDataPoint[]>([]);
  const [liveChartData, setLiveChartData] = useState<ChartDataPoint[]>([]);
  const [recentChartData, setRecentChartData] = useState<ChartDataPoint[]>([]);
  const deltaBufferRef = useRef<number[]>([]);

  // Minute buckets
  const minuteBucketsRef = useRef<MinuteBucket[]>([]);
  const [minuteBuckets, setMinuteBuckets] = useState<MinuteBucket[]>([]);
  const currentMinuteRef = useRef({ good: 0, total: 0 });
  const lastMinuteIndexRef = useRef(0);

  // AI coach
  const [currentTip, setCurrentTip] = useState(DEFAULT_TIP);
  const [isFetchingTip, setIsFetchingTip] = useState(false);
  const [lastTipFetchedAt, setLastTipFetchedAt] = useState<number | null>(null);

  const wasSlouchingRef = useRef(false);

  // Session controls
  const startSession = useCallback(() => {
    setSessionState("running");
    setSessionStart(Date.now());
    setSessionDuration(0);
    setGoodReadings(0);
    setTotalReadings(0);
    setAlertCount(0);
    setBestStreak(0);
    setCurrentSlouchDuration(0);
    setCurrentStreakDuration(0);
    setIsSlouchingNow(false);
    allSessionDataRef.current = [];
    deltaBufferRef.current = [];
    minuteBucketsRef.current = [];
    currentMinuteRef.current = { good: 0, total: 0 };
    lastMinuteIndexRef.current = 0;
    setLiveChartData([]);
    setRecentChartData([]);
    setMinuteBuckets([]);
    wasSlouchingRef.current = false;
  }, []);

  const pauseSession = useCallback(() => {
    setSessionState("paused");
  }, []);

  const resumeSession = useCallback(() => {
    setSessionState("running");
  }, []);

  const stopSession = useCallback((): SessionSaveData => {
    const data: SessionSaveData = {
      startTime: sessionStart ?? Date.now(),
      allChartData: [...allSessionDataRef.current],
      sessionDuration,
      goodPct:
        totalReadings > 0
          ? Math.round((goodReadings / totalReadings) * 100)
          : 100,
      alertCount,
      bestStreak,
    };
    setSessionState("idle");
    setSessionStart(null);
    setSessionDuration(0);
    setIsSlouchingNow(false);
    setCurrentSlouchDuration(0);
    setCurrentStreakDuration(0);
    allSessionDataRef.current = [];
    setLiveChartData([]);
    setRecentChartData([]);
    setMinuteBuckets([]);
    return data;
  }, [sessionStart, sessionDuration, goodReadings, totalReadings, alertCount, bestStreak]);

  // Session timer
  useEffect(() => {
    if (sessionState !== "running" || !sessionStart) return;

    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, sessionStart]);

  // Track the last rawPitch we processed to detect new readings
  const lastProcessedPitchRef = useRef<number | null>(null);

  // Process incoming data (only when running)
  useEffect(() => {
    if (sessionState !== "running" || !serial.isConnected) return;

    // Only process if we have a new reading
    if (serial.rawPitch === lastProcessedPitchRef.current) return;
    lastProcessedPitchRef.current = serial.rawPitch;

    const delta = serial.currentDelta;
    const isCurrentlySlouching = delta > slouchThreshold;
    setIsSlouchingNow(isCurrentlySlouching);

    setTotalReadings((prev) => prev + 1);
    if (!isCurrentlySlouching) {
      setGoodReadings((prev) => prev + 1);
    }

    currentMinuteRef.current.total += 1;
    if (!isCurrentlySlouching) {
      currentMinuteRef.current.good += 1;
    }

    if (isCurrentlySlouching && !wasSlouchingRef.current) {
      setAlertCount((prev) => prev + 1);
    }
    wasSlouchingRef.current = isCurrentlySlouching;

    deltaBufferRef.current.push(delta);
  }, [serial.rawPitch, serial.currentDelta, serial.isConnected, slouchThreshold, sessionState]);

  // Update streaks (1Hz, only when running)
  useEffect(() => {
    if (sessionState !== "running") return;

    const interval = setInterval(() => {
      if (isSlouchingNow) {
        setCurrentSlouchDuration((prev) => prev + 1);
        setCurrentStreakDuration(0);
      } else {
        setCurrentSlouchDuration(0);
        setCurrentStreakDuration((prev) => {
          const newStreak = prev + 1;
          setBestStreak((best) => Math.max(best, newStreak));
          return newStreak;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, isSlouchingNow]);

  // Update chart data on sessionDuration tick (only when running)
  useEffect(() => {
    if (sessionState !== "running" || sessionDuration === 0) return;

    const buffer = deltaBufferRef.current;
    if (buffer.length === 0) return;

    const avgDelta = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    deltaBufferRef.current = [];

    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const newPoint: ChartDataPoint = {
      time: timeLabel,
      delta: Math.round(avgDelta * 10) / 10,
      threshold: slouchThreshold,
    };

    allSessionDataRef.current.push(newPoint);

    const allData = allSessionDataRef.current;
    setLiveChartData(allData.slice(-CHART_HISTORY_SECONDS));
    setRecentChartData(allData.slice(-RECENT_HISTORY_SECONDS));

    const currentMinuteIndex = Math.floor(sessionDuration / 60);
    if (
      currentMinuteIndex > lastMinuteIndexRef.current &&
      lastMinuteIndexRef.current > 0
    ) {
      const { good, total } = currentMinuteRef.current;
      if (total > 0) {
        const pct = Math.round((good / total) * 100);
        const idx = lastMinuteIndexRef.current;
        const label = `${idx - 1}-${idx}m`;
        const bucket: MinuteBucket = {
          label,
          goodPct: pct,
          totalReadings: total,
        };
        minuteBucketsRef.current = [...minuteBucketsRef.current, bucket];
      }
      currentMinuteRef.current = { good: 0, total: 0 };
      lastMinuteIndexRef.current = currentMinuteIndex;
    } else if (lastMinuteIndexRef.current === 0 && sessionDuration > 0) {
      lastMinuteIndexRef.current = currentMinuteIndex;
    }

    const { good, total } = currentMinuteRef.current;
    const completedBuckets = minuteBucketsRef.current;
    if (total > 0) {
      const partialPct = Math.round((good / total) * 100);
      const idx = Math.floor(sessionDuration / 60);
      const partialLabel = `${idx}-${idx + 1}m`;
      const partial: MinuteBucket = {
        label: partialLabel,
        goodPct: partialPct,
        totalReadings: total,
      };
      setMinuteBuckets([...completedBuckets, partial]);
    } else {
      setMinuteBuckets(completedBuckets);
    }
  }, [sessionState, sessionDuration, slouchThreshold]);

  // Fetch AI tip
  const fetchTip = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setCurrentTip(DEFAULT_TIP);
      return;
    }

    setIsFetchingTip(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 60,
          messages: [
            {
              role: "user",
              content: `You are SpineSync, a smart posture coach. The user has been slouching for ${currentSlouchDuration} seconds with a spine angle ${serial.currentDelta.toFixed(1)}° off their baseline. Give one short actionable tip, max 15 words, no intro, direct and human.`,
            },
          ],
        }),
      });
      const data = await response.json();
      if (data.content?.[0]?.text) {
        setCurrentTip(data.content[0].text);
      }
    } catch {
      setCurrentTip(DEFAULT_TIP);
    } finally {
      setIsFetchingTip(false);
      setLastTipFetchedAt(Date.now());
    }
  }, [currentSlouchDuration, serial.currentDelta]);

  useEffect(() => {
    if (sessionState !== "running") return;
    if (currentSlouchDuration >= TIP_TRIGGER_DURATION) {
      const shouldFetch =
        lastTipFetchedAt === null || Date.now() - lastTipFetchedAt > 60000;
      if (shouldFetch && !isFetchingTip) {
        fetchTip();
      }
    }
  }, [sessionState, currentSlouchDuration, lastTipFetchedAt, isFetchingTip, fetchTip]);

  const goodPct =
    totalReadings > 0
      ? Math.round((goodReadings / totalReadings) * 100)
      : 100;

  return {
    // Serial connection
    isConnected: serial.isConnected,
    connectSerial: serial.connect,
    disconnectSerial: serial.disconnect,

    // Session state
    sessionState,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,

    // Live data
    currentDelta: serial.currentDelta,
    rawPitch: serial.rawPitch,
    isSlouchingNow,
    currentSlouchDuration,
    currentStreakDuration,

    // Chart data
    liveChartData,
    recentChartData,

    // Session stats
    sessionDuration,
    goodPct,
    alertCount,
    bestStreak,

    // History
    minuteBuckets,

    // AI coach
    currentTip,
    isFetchingTip,
    lastTipFetchedAt,

    // Actions
    calibrate: serial.calibrate,
    fetchTip,
  };
}
