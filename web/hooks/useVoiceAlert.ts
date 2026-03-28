"use client";

import { useEffect, useRef } from "react";
import { ELEVENLABS_VOICE_ID, VOICE_MESSAGES, ALERT_COOLDOWN } from "@/lib/constants";

interface UseVoiceAlertProps {
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
}

export function useVoiceAlert({ isSlouchingNow, currentSlouchDuration }: UseVoiceAlertProps) {
  const lastAlertTimeRef = useRef<number>(0);
  const lastAlertDurationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) return;

    if (!isSlouchingNow) {
      lastAlertDurationRef.current = 0;
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN * 1000) {
      return;
    }

    // Determine which message to play based on duration
    let message: string | null = null;
    let triggerDuration: number | null = null;

    if (currentSlouchDuration >= 60 && lastAlertDurationRef.current < 60) {
      message = VOICE_MESSAGES[60];
      triggerDuration = 60;
    } else if (currentSlouchDuration >= 30 && lastAlertDurationRef.current < 30) {
      message = VOICE_MESSAGES[30];
      triggerDuration = 30;
    } else if (currentSlouchDuration >= 10 && lastAlertDurationRef.current < 10) {
      message = VOICE_MESSAGES[10];
      triggerDuration = 10;
    }

    if (message && triggerDuration) {
      lastAlertDurationRef.current = triggerDuration;
      playVoiceAlert(apiKey, message);
      lastAlertTimeRef.current = now;
    }
  }, [isSlouchingNow, currentSlouchDuration]);

  async function playVoiceAlert(apiKey: string, message: string) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: message,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        // Silently fail if autoplay is blocked
      });

      // Cleanup URL after playing
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch {
      // Silently fail
    }
  }
}
