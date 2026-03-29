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

const MAX_DELAY = 60; // stop incrementing once delay >= 60s

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

  // How many punishments have fired in this slouch bout
  const hitCountRef = useRef(0);
  const nextTriggerRef = useRef(0);
  const wasSlouchingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!sessionRunning) return;

    // Reset when slouching stops
    if (!isSlouchingNow) {
      if (wasSlouchingRef.current) {
        hitCountRef.current = 0;
        nextTriggerRef.current = 0;
      }
      wasSlouchingRef.current = false;
      return;
    }

    // Slouching just started — set first trigger
    if (!wasSlouchingRef.current) {
      wasSlouchingRef.current = true;
      hitCountRef.current = 0;
      nextTriggerRef.current = punishmentDelay;
    }

    // Not yet time
    if (currentSlouchDuration < nextTriggerRef.current) return;

    // Fire punishment
    hitCountRef.current += 1;

    // Schedule next: (hitCount+1) * delay, capped at 60s increments
    const nextMultiplier = hitCountRef.current + 1;
    const nextDelay = Math.min(nextMultiplier * punishmentDelay, MAX_DELAY);
    nextTriggerRef.current = currentSlouchDuration + nextDelay;

    // Skip if previous clip is still playing
    if (audioRef.current && !audioRef.current.ended && !audioRef.current.paused) {
      return;
    }

    // Play sound
    const isCoach =
      settings.instructionType === "coach" &&
      settings.coachAudioFiles.length > 0;

    let soundUrl: string;
    if (isCoach) {
      const file =
        settings.coachAudioFiles[
          Math.floor(Math.random() * settings.coachAudioFiles.length)
        ];
      soundUrl = `/audio/${file}`;
    } else {
      soundUrl = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
    }

    const audio = new Audio(soundUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});

    // Trigger the needle
    onPoke?.();

    if (onPunishment) {
      const minutes = Math.floor(sessionDuration / 60);
      const seconds = sessionDuration % 60;
      onPunishment({
        time: `${minutes}:${seconds.toString().padStart(2, "0")}`,
        secondsIn: sessionDuration,
        type: isCoach ? "coach" : "fart",
      });
    }
  }, [
    sessionRunning,
    isSlouchingNow,
    currentSlouchDuration,
    sessionDuration,
    punishmentDelay,
    settings.instructionType,
    settings.coachAudioFiles,
    onPunishment,
    onPoke,
  ]);
}
