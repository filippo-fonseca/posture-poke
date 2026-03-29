"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";
import type { PunishmentMarker } from "@/lib/types";

const FART_SOUNDS = [
  "/audio/fart-01.mp3",
  "/audio/fart-02.mp3",
  "/audio/fart-03.mp3",
  "/audio/fart-04.mp3",
  "/audio/fart-05.mp3",
  "/audio/fart-06.mp3",
  "/audio/fart-07.mp3",
  "/audio/fart-08.mp3",
  "/audio/fart-squeak-01.mp3",
  "/audio/fart-squeak-02.mp3",
  "/audio/fart-squeak-03.mp3",
];

const BEEP_SOUNDS = ["/audio/beep-01.mp3"];

const MAX_DELAY = 60;

interface UseVoiceAlertProps {
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
  sessionDuration: number;
  sessionRunning: boolean;
  onPunishment?: (marker: PunishmentMarker) => void;
  onPoke?: () => void;
}

export function useVoiceAlert({
  isSlouchingNow,
  currentSlouchDuration,
  sessionDuration,
  sessionRunning,
  onPunishment,
  onPoke,
}: UseVoiceAlertProps) {
  const { settings, punishmentDelay } = useSettings();

  const hitCountRef = useRef(0);
  const nextTriggerRef = useRef(0);
  const wasSlouchingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!sessionRunning || !settings.punishmentsEnabled) return;

    // Reset when slouching stops
    if (!isSlouchingNow) {
      if (wasSlouchingRef.current) {
        hitCountRef.current = 0;
        nextTriggerRef.current = 0;
      }
      wasSlouchingRef.current = false;
      return;
    }

    // Slouching just started
    if (!wasSlouchingRef.current) {
      wasSlouchingRef.current = true;
      hitCountRef.current = 0;
      nextTriggerRef.current = punishmentDelay;
    }

    if (currentSlouchDuration < nextTriggerRef.current) return;

    // Fire punishment
    hitCountRef.current += 1;
    const nextMultiplier = hitCountRef.current + 1;
    const nextDelay = Math.min(nextMultiplier * punishmentDelay, MAX_DELAY);
    nextTriggerRef.current = currentSlouchDuration + nextDelay;

    // Skip if previous clip is still playing
    if (audioRef.current && !audioRef.current.ended && !audioRef.current.paused) {
      return;
    }

    // Build pool of available sounds from enabled audio punishments
    const audioPunishments = settings.audioPunishments ?? [];
    const soundPool: string[] = [];
    let punishmentType: "fart" | "coach" = "fart";

    for (const type of audioPunishments) {
      if (type === "beep") {
        soundPool.push(...BEEP_SOUNDS);
      } else if (type === "farts") {
        soundPool.push(...FART_SOUNDS);
      } else if (type === "coach" && settings.coachAudioFiles.length > 0) {
        soundPool.push(
          ...settings.coachAudioFiles.map((f) => `/audio/${f}`)
        );
      }
    }

    // Play a random sound from the pool
    if (soundPool.length > 0) {
      const soundUrl = soundPool[Math.floor(Math.random() * soundPool.length)];
      // Determine type for the marker
      if (soundUrl.includes("fart")) punishmentType = "fart";
      else punishmentType = "coach";

      const audio = new Audio(soundUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }

    // Trigger the poker if enabled
    if (settings.pokeEnabled) {
      onPoke?.();
    }

    if (onPunishment) {
      const minutes = Math.floor(sessionDuration / 60);
      const seconds = sessionDuration % 60;
      onPunishment({
        time: `${minutes}:${seconds.toString().padStart(2, "0")}`,
        secondsIn: sessionDuration,
        type: punishmentType,
      });
    }
  }, [
    sessionRunning,
    isSlouchingNow,
    currentSlouchDuration,
    sessionDuration,
    punishmentDelay,
    settings.punishmentsEnabled,
    settings.pokeEnabled,
    settings.audioPunishments,
    settings.coachAudioFiles,
    onPunishment,
    onPoke,
  ]);
}
