"use client";

import { useEffect, useRef } from "react";

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

const SLOUCH_TRIGGER = 10; // seconds before first fart
const COOLDOWN = 15; // seconds between repeated farts

interface UseVoiceAlertProps {
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
}

export function useVoiceAlert({ isSlouchingNow, currentSlouchDuration }: UseVoiceAlertProps) {
  const lastPlayedRef = useRef<number>(0);

  useEffect(() => {
    if (!isSlouchingNow || currentSlouchDuration < SLOUCH_TRIGGER) return;

    const now = Date.now();
    if (now - lastPlayedRef.current < COOLDOWN * 1000) return;

    lastPlayedRef.current = now;
    const sound = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
    const audio = new Audio(sound);
    audio.play().catch(() => {});
  }, [isSlouchingNow, currentSlouchDuration]);
}
