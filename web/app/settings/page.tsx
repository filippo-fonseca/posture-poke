"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSettings,
  STRICTNESS_LEVELS,
  HARSHNESS_LEVELS,
} from "@/lib/settings";
import { AuthGuard } from "@/components/AuthGuard";
import { useCoaches } from "@/hooks/useCoaches";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const { settings, update } = useSettings();
  const router = useRouter();
  const {
    coaches,
    loading: coachesLoading,
    canCreate,
    createCoach,
    deleteCoach,
    setActiveCoach,
  } = useCoaches();
  const [isGenerating, setIsGenerating] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!coachPrompt.trim() || !canCreate) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      await createCoach(coachPrompt);
      setCoachPrompt("");
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
              onClick={() => router.push("/dashboard")}
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

          {/* Coach Management */}
          {settings.instructionType === "coach" && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h2 className="text-sm font-medium">Your Coaches</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {coaches.length}/5 coaches
                  </p>
                </div>
              </div>

              {/* Existing coaches */}
              {coachesLoading ? (
                <div className="space-y-2">
                  <div className="shimmer h-16 w-full rounded-lg" />
                  <div className="shimmer h-16 w-full rounded-lg" />
                </div>
              ) : (
                <div className="space-y-2">
                  {coaches.map((coach) => (
                    <div
                      key={coach.id}
                      className={`rounded-lg border p-3 flex items-center justify-between transition-colors cursor-pointer ${
                        settings.activeCoachId === coach.id
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                      onClick={() => coach.id && setActiveCoach(coach.id)}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm truncate">
                          {coach.description}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {coach.audioFiles.length} clips
                          {settings.activeCoachId === coach.id && (
                            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              Active
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (coach.id) deleteCoach(coach.id);
                        }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                        aria-label="Delete coach"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new coach */}
              {canCreate && (
                <div className="mt-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4">
                  <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    Create New Coach
                  </h3>
                  <textarea
                    value={coachPrompt}
                    onChange={(e) => setCoachPrompt(e.target.value)}
                    placeholder='e.g. A sarcastic Gordon Ramsay-like drill sergeant who roasts your posture...'
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
                    rows={2}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !coachPrompt.trim()}
                      className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {isGenerating ? "Generating..." : "Generate Coach"}
                    </button>
                    {isGenerating && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        This may take a minute...
                      </span>
                    )}
                  </div>
                  {generateError && (
                    <p className="mt-2 text-xs text-red-500">{generateError}</p>
                  )}
                </div>
              )}

              {!canCreate && (
                <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Maximum 5 coaches reached. Delete one to create a new one.
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
