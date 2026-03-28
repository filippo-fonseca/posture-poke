"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { AuthGuard } from "@/components/AuthGuard";
import type { SessionDoc } from "@/lib/types";

export default function SessionsPage() {
  return (
    <AuthGuard>
      <SessionsContent />
    </AuthGuard>
  );
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SessionsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", user.uid, "sessions"),
      orderBy("endedAt", "desc")
    );
    getDocs(q).then((snap) => {
      setSessions(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
              startedAt:
                d.data().startedAt?.toMillis?.() ?? d.data().startedAt,
              endedAt: d.data().endedAt?.toMillis?.() ?? d.data().endedAt,
            } as SessionDoc)
        )
      );
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
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
              Dashboard
            </button>
            <h1 className="text-lg font-bold tracking-tight">
              Past Sessions
            </h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="mb-3 text-zinc-300 dark:text-zinc-600"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No sessions yet. Start one from the dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/sessions/${s.id}`)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(s.endedAt)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {formatDuration(s.durationSeconds)} &middot;{" "}
                      {s.alertCount} alert{s.alertCount !== 1 ? "s" : ""}{" "}
                      &middot; {s.punishmentMarkers?.length ?? 0} punishment
                      {(s.punishmentMarkers?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-lg font-medium ${
                      s.goodPct >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : s.goodPct >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {s.goodPct}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
