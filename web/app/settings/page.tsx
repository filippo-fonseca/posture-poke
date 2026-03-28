"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSettings,
  STRICTNESS_LEVELS,
  HARSHNESS_LEVELS,
} from "@/lib/settings";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState(settings.coachDescription);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!coachPrompt.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/coach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: coachPrompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate coach");
      }

      const data = await res.json();
      update({
        coachDescription: coachPrompt.trim(),
        coachAudioFiles: data.audio_files,
      });
    } catch (err: unknown) {
      setGenerateError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-lg font-bold tracking-tight">Settings</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="space-y-10">
          {/* Strictness */}
          <section>
            <h2 className="text-sm font-medium mb-1">Strictness</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              How far you can deviate before posture is considered bad
            </p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {STRICTNESS_LEVELS.map((level, i) => (
                <button
                  key={level.name}
                  onClick={() => update({ strictness: i })}
                  className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    settings.strictness === i
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <span className="block text-[11px] sm:text-xs font-medium leading-tight">
                    {level.name}
                  </span>
                  <span className="block text-[10px] mt-0.5 opacity-60">
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Harshness */}
          <section>
            <h2 className="text-sm font-medium mb-1">Harshness</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              How long you get before punishment kicks in
            </p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {HARSHNESS_LEVELS.map((level, i) => (
                <button
                  key={level.name}
                  onClick={() => update({ harshness: i })}
                  className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    settings.harshness === i
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <span className="block text-[11px] sm:text-xs font-medium leading-tight">
                    {level.name}
                  </span>
                  <span className="block text-[10px] mt-0.5 opacity-60">
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Punishment Type */}
          <section>
            <h2 className="text-sm font-medium mb-1">Punishment Type</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              What happens when you slouch for too long
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => update({ instructionType: "farts" })}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  settings.instructionType === "farts"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <span className="block text-sm font-medium">Fart Sounds</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Classic. Effective. Embarrassing.
                </span>
              </button>
              <button
                onClick={() => update({ instructionType: "coach" })}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  settings.instructionType === "coach"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <span className="block text-sm font-medium">
                  Let Coach Speak
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  AI-generated voice roasts you into shape
                </span>
              </button>
            </div>
          </section>

          {/* Coach config */}
          {settings.instructionType === "coach" && (
            <section>
              <h2 className="text-sm font-medium mb-1">Coach Personality</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Describe your coach&apos;s voice and personality. 10 unique
                audio clips will be generated.
              </p>
              <textarea
                value={coachPrompt}
                onChange={(e) => setCoachPrompt(e.target.value)}
                placeholder='e.g. A sarcastic Gordon Ramsay-like drill sergeant who roasts your posture with British wit...'
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
                rows={3}
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !coachPrompt.trim()}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {isGenerating ? "Generating..." : "Generate Coach"}
                </button>
                {settings.coachAudioFiles.length > 0 && !isGenerating && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {settings.coachAudioFiles.length} clips ready
                  </span>
                )}
                {isGenerating && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    This may take a minute...
                  </span>
                )}
              </div>
              {generateError && (
                <p className="mt-2 text-xs text-red-500">{generateError}</p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
