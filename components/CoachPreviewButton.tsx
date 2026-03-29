"use client";

import { useState, useRef, useEffect } from "react";
import type { CoachDoc } from "@/lib/types";

export function CoachPreviewButton({ coach }: { coach: CoachDoc }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    if (coach.audioFiles.length === 0) return;
    const file =
      coach.audioFiles[Math.floor(Math.random() * coach.audioFiles.length)];
    const audio = new Audio(`/audio/${file}`);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.play().catch(() => {});
    setPlaying(true);
  };

  return (
    <button
      onClick={toggle}
      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      title={playing ? "Stop preview" : "Preview coach"}
    >
      {playing ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
