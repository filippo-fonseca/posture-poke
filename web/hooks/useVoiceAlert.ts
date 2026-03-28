"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";

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

const COOLDOWN = 15; // seconds between sounds

interface UseVoiceAlertProps {
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
}

export function useVoiceAlert({
  isSlouchingNow,
  currentSlouchDuration,
}: UseVoiceAlertProps) {
  const { settings, punishmentDelay } = useSettings();
  const lastPlayedRef = useRef<number>(0);

  useEffect(() => {
    if (!isSlouchingNow || currentSlouchDuration < punishmentDelay) return;

    const now = Date.now();
    if (now - lastPlayedRef.current < COOLDOWN * 1000) return;

    lastPlayedRef.current = now;

    let soundUrl: string;
    if (
      settings.instructionType === "coach" &&
      settings.coachAudioFiles.length > 0
    ) {
      const file =
        settings.coachAudioFiles[
          Math.floor(Math.random() * settings.coachAudioFiles.length)
        ];
      soundUrl = `/audio/${file}`;
    } else {
      soundUrl = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
    }

    const audio = new Audio(soundUrl);
    audio.play().catch(() => {});
  }, [
    isSlouchingNow,
    currentSlouchDuration,
    punishmentDelay,
    settings.instructionType,
    settings.coachAudioFiles,
  ]);
}
