"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePostureStream } from "./usePostureStream";
import { ChartDataPoint, MinuteBucket, PostureSession } from "@/lib/types";
import {
  SLOUCH_THRESHOLD,
  DEFAULT_TIP,
  CHART_HISTORY_SECONDS,
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

  // Chart data
  const [liveChartData, setLiveChartData] = useState<ChartDataPoint[]>([]);
  const lastChartUpdateRef = useRef<number>(0);
  const deltaBufferRef = useRef<number[]>([]);

  // Minute buckets
  const [minuteBuckets, setMinuteBuckets] = useState<MinuteBucket[]>([]);
  const currentMinuteRef = useRef({ good: 0, total: 0 });

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

  // Update chart data (1Hz - downsample from 20Hz)
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      const buffer = deltaBufferRef.current;
      if (buffer.length === 0) return;

      // Average the buffered readings
      const avgDelta = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      deltaBufferRef.current = [];

      const timeInSession = sessionDuration;
      const minutes = Math.floor(timeInSession / 60);
      const seconds = timeInSession % 60;
      const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLiveChartData((prev) => {
        const newPoint: ChartDataPoint = {
          time: timeLabel,
          delta: Math.round(avgDelta * 10) / 10,
          threshold: SLOUCH_THRESHOLD,
        };

        const updated = [...prev, newPoint];
        // Keep last 60 seconds
        if (updated.length > CHART_HISTORY_SECONDS) {
          return updated.slice(-CHART_HISTORY_SECONDS);
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, sessionDuration]);

  // Update minute buckets
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      const { good, total } = currentMinuteRef.current;
      if (total > 0) {
        const pct = Math.round((good / total) * 100);
        const minuteIndex = minuteBuckets.length;
        const label = `${minuteIndex}-${minuteIndex + 1}m`;

        setMinuteBuckets((prev) => [
          ...prev,
          { label, goodPct: pct, totalReadings: total },
        ]);
      }
      currentMinuteRef.current = { good: 0, total: 0 };
    }, 60000);

    return () => clearInterval(interval);
  }, [isConnected, minuteBuckets.length]);

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

  const goodPct = totalReadings > 0 ? Math.round((goodReadings / totalReadings) * 100) : 100;

  return {
    isConnected,
    currentDelta,
    isSlouchingNow,
    currentSlouchDuration,
    currentStreakDuration,
    liveChartData,
    sessionDuration,
    goodPct,
    alertCount,
    bestStreak,
    minuteBuckets,
    currentTip,
    isFetchingTip,
    lastTipFetchedAt,
    calibrate: sendCalibrate,
    fetchTip,
  };
}
