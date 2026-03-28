"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePostureStream } from "./usePostureStream";
import { ChartDataPoint, MinuteBucket, PostureSession } from "@/lib/types";
import {
  SLOUCH_THRESHOLD,
  DEFAULT_TIP,
  CHART_HISTORY_SECONDS,
  RECENT_HISTORY_SECONDS,
  TIP_TRIGGER_DURATION,
} from "@/lib/constants";

export function usePostureSession(): PostureSession {
  const { isConnected, currentDelta, lastTimestamp, sendCalibrate } = usePostureStream();

  // Session tracking
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

  // Chart data - full session stored in ref, derived views in state
  const allSessionDataRef = useRef<ChartDataPoint[]>([]);
  const [liveChartData, setLiveChartData] = useState<ChartDataPoint[]>([]);
  const [recentChartData, setRecentChartData] = useState<ChartDataPoint[]>([]);
  const deltaBufferRef = useRef<number[]>([]);

  // Minute buckets - stored in ref to avoid dependency issues
  const minuteBucketsRef = useRef<MinuteBucket[]>([]);
  const [minuteBuckets, setMinuteBuckets] = useState<MinuteBucket[]>([]);
  const currentMinuteRef = useRef({ good: 0, total: 0 });
  const lastMinuteIndexRef = useRef(0);

  // AI coach
  const [currentTip, setCurrentTip] = useState(DEFAULT_TIP);
  const [isFetchingTip, setIsFetchingTip] = useState(false);
  const [lastTipFetchedAt, setLastTipFetchedAt] = useState<number | null>(null);

  // Track previous slouch state for alert counting
  const wasSlouchingRef = useRef(false);

  // Session timer
  useEffect(() => {
    if (!isConnected) return;

    if (sessionStart === null) {
      setSessionStart(Date.now());
    }

    const interval = setInterval(() => {
      if (sessionStart) {
        setSessionDuration(Math.floor((Date.now() - sessionStart) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, sessionStart]);

  // Process incoming data
  useEffect(() => {
    if (!isConnected || lastTimestamp === null) return;

    const isCurrentlySlouching = currentDelta > SLOUCH_THRESHOLD;
    setIsSlouchingNow(isCurrentlySlouching);

    // Count readings
    setTotalReadings((prev) => prev + 1);
    if (!isCurrentlySlouching) {
      setGoodReadings((prev) => prev + 1);
    }

    // Track minute bucket
    currentMinuteRef.current.total += 1;
    if (!isCurrentlySlouching) {
      currentMinuteRef.current.good += 1;
    }

    // Detect threshold crossings (slouch start)
    if (isCurrentlySlouching && !wasSlouchingRef.current) {
      setAlertCount((prev) => prev + 1);
    }
    wasSlouchingRef.current = isCurrentlySlouching;

    // Buffer delta for chart (we downsample to 1/sec)
    deltaBufferRef.current.push(currentDelta);
  }, [currentDelta, lastTimestamp, isConnected]);

  // Update streaks and slouch duration (1Hz)
  useEffect(() => {
    if (!isConnected) return;

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
  }, [isConnected, isSlouchingNow]);

  // Update chart data every time sessionDuration ticks (1Hz, no interval lag)
  useEffect(() => {
    if (!isConnected || sessionDuration === 0) return;

    const buffer = deltaBufferRef.current;
    if (buffer.length === 0) return;

    // Average the buffered readings
    const avgDelta = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    deltaBufferRef.current = [];

    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const newPoint: ChartDataPoint = {
      time: timeLabel,
      delta: Math.round(avgDelta * 10) / 10,
      threshold: SLOUCH_THRESHOLD,
    };

    // Push to full session history
    allSessionDataRef.current.push(newPoint);

    // Derive views
    const allData = allSessionDataRef.current;
    setLiveChartData(allData.slice(-CHART_HISTORY_SECONDS));
    setRecentChartData(allData.slice(-RECENT_HISTORY_SECONDS));

    // Check if we crossed a minute boundary
    const currentMinuteIndex = Math.floor(sessionDuration / 60);
    if (currentMinuteIndex > lastMinuteIndexRef.current && lastMinuteIndexRef.current > 0) {
      const { good, total } = currentMinuteRef.current;
      if (total > 0) {
        const pct = Math.round((good / total) * 100);
        const idx = lastMinuteIndexRef.current;
        const label = `${idx - 1}-${idx}m`;
        const bucket: MinuteBucket = { label, goodPct: pct, totalReadings: total };
        minuteBucketsRef.current = [...minuteBucketsRef.current, bucket];
      }
      currentMinuteRef.current = { good: 0, total: 0 };
      lastMinuteIndexRef.current = currentMinuteIndex;
    } else if (lastMinuteIndexRef.current === 0 && sessionDuration > 0) {
      lastMinuteIndexRef.current = currentMinuteIndex;
    }

    // Build minute buckets with current partial minute for display
    const { good, total } = currentMinuteRef.current;
    const completedBuckets = minuteBucketsRef.current;
    if (total > 0) {
      const partialPct = Math.round((good / total) * 100);
      const idx = Math.floor(sessionDuration / 60);
      const partialLabel = `${idx}-${idx + 1}m`;
      const partial: MinuteBucket = { label: partialLabel, goodPct: partialPct, totalReadings: total };
      setMinuteBuckets([...completedBuckets, partial]);
    } else {
      setMinuteBuckets(completedBuckets);
    }
  }, [isConnected, sessionDuration]);

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
              content: `You are SpineSync, a smart posture coach. The user has been slouching for ${currentSlouchDuration} seconds with a spine angle ${currentDelta.toFixed(1)}° off their baseline. Give one short actionable tip, max 15 words, no intro, direct and human.`,
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
  }, [currentSlouchDuration, currentDelta]);

  // Auto-fetch tip when slouching too long
  useEffect(() => {
    if (currentSlouchDuration >= TIP_TRIGGER_DURATION) {
      const shouldFetch =
        lastTipFetchedAt === null || Date.now() - lastTipFetchedAt > 60000;

      if (shouldFetch && !isFetchingTip) {
        fetchTip();
      }
    }
  }, [currentSlouchDuration, lastTipFetchedAt, isFetchingTip, fetchTip]);

  const calibrate = useCallback(() => {
    sendCalibrate();
  }, [sendCalibrate]);

  const goodPct = totalReadings > 0 ? Math.round((goodReadings / totalReadings) * 100) : 100;

  return {
    isConnected,
    currentDelta,
    isSlouchingNow,
    currentSlouchDuration,
    currentStreakDuration,
    liveChartData,
    recentChartData,
    sessionDuration,
    goodPct,
    alertCount,
    bestStreak,
    minuteBuckets,
    currentTip,
    isFetchingTip,
    lastTipFetchedAt,
    calibrate,
    fetchTip,
  };
}
