"use client";

import { motion } from "framer-motion";

interface HeaderProps {
  isConnected: boolean;
  sessionDuration: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function Header({ isConnected, sessionDuration }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-base/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Tagline */}
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white">
              SpineSync
            </h1>
            <p className="text-xs text-text-secondary">
              we got your back. literally.
            </p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            <ConnectionStatus
              isConnected={isConnected}
              sessionDuration={sessionDuration}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function ConnectionStatus({
  isConnected,
  sessionDuration,
}: {
  isConnected: boolean;
  sessionDuration: number;
}) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-text-tertiary/20 px-3 py-1.5 status-connecting">
        <div className="h-2 w-2 rounded-full bg-amber-500" />
        <span className="font-mono text-xs text-amber-500">Connecting...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 rounded-full bg-accent-green-dim px-3 py-1.5"
    >
      <div className="h-2 w-2 rounded-full bg-accent-green" />
      <span className="font-mono text-xs text-accent-green">
        Live · {formatTime(sessionDuration)}
      </span>
    </motion.div>
  );
}
