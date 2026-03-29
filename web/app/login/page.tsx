"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { SpineDecoration } from "@/components/SpineDecoration";

const MESSAGES = [
  "How straight are you? (literally)",
  "Your spine filed a complaint.",
  "Slouching is not a personality trait.",
  "Your chiropractor called. Again.",
  "Sit up. Your mother is watching.",
  "That posture? In this economy?",
  "Your back called. It wants a divorce.",
  "You're built like a question mark.",
  "Even your shadow is slouching.",
  "Posture check. You failed.",
];

function useTypewriter(messages: string[], typingSpeed = 50, pauseMs = 2000) {
  const [display, setDisplay] = useState("");
  const msgRef = useRef(0);
  const charRef = useRef(0);
  const deletingRef = useRef(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    function tick() {
      const current = messages[msgRef.current];

      if (!deletingRef.current) {
        if (charRef.current < current.length) {
          charRef.current += 1;
          setDisplay(current.slice(0, charRef.current));
          timeout = setTimeout(tick, typingSpeed);
        } else {
          deletingRef.current = true;
          timeout = setTimeout(tick, pauseMs);
        }
      } else {
        if (charRef.current > 0) {
          charRef.current -= 1;
          setDisplay(current.slice(0, charRef.current));
          timeout = setTimeout(tick, typingSpeed / 2);
        } else {
          deletingRef.current = false;
          msgRef.current = (msgRef.current + 1) % messages.length;
          timeout = setTimeout(tick, typingSpeed);
        }
      }
    }

    timeout = setTimeout(tick, typingSpeed);
    return () => clearTimeout(timeout);
  }, [messages, typingSpeed, pauseMs]);

  return display;
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const typed = useTypewriter(MESSAGES, 45, 2200);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SpineDecoration />

      <header className="relative z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <img src="/logo.svg" alt="" className="h-5 w-5 dark:invert" />
              PosturePoke
            </span>
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight min-h-[4rem] flex items-center justify-center">
              <span>
                {typed}
                <span className="inline-block w-[2px] h-5 bg-zinc-900 dark:bg-zinc-100 ml-0.5 align-middle animate-pulse-dot" />
              </span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to start fixing that posture
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <ScaredButton />
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            By signing in, you agree to let us judge your posture.
          </p>
        </div>

        {/* Punishment methods */}
        <div className="w-full max-w-lg mt-14">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center mb-4">
            What happens when you slouch?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {PUNISHMENTS.map((p) => (
              <div
                key={p.title}
                className={`rounded-lg border ${BORDER_COLORS[p.color]} bg-white dark:bg-zinc-900 p-4`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={ICON_COLORS[p.color]}>{p.icon}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${SEVERITY_COLORS[p.color]}`}>
                    {p.severity}
                  </span>
                </div>
                <h4 className="text-sm font-semibold">{p.title}</h4>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Scared button ───────────────────────────────────────────────────────────

const SCARED_RESPONSES = [
  "You really thought you could get away?",
  "Your spine doesn't get a day off.",
  "Cowardice causes slouching. Look it up.",
  "Running won't fix your posture.",
  "Fear is temporary. Back pain is forever.",
  "That's what your spine said too.",
  "No escape. Only good posture.",
  "Cute. Now sit up straight.",
];

function ScaredButton() {
  const [clicked, setClicked] = useState(false);
  const [message, setMessage] = useState(
    () => SCARED_RESPONSES[Math.floor(Math.random() * SCARED_RESPONSES.length)]
  );

  useEffect(() => {
    if (!clicked) return;
    const timeout = setTimeout(() => {
      setClicked(false);
      setMessage(SCARED_RESPONSES[Math.floor(Math.random() * SCARED_RESPONSES.length)]);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [clicked]);

  return (
    <div className="relative mt-3 h-[42px]">
      <button
        onClick={() => setClicked(true)}
        className={`relative z-10 w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 transition-all duration-500 hover:bg-zinc-700 dark:hover:bg-zinc-300 ${
          clicked ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        I&apos;m scared
      </button>
      <p
        className={`absolute inset-0 flex items-center justify-center text-xs font-medium text-red-500 dark:text-red-400 pointer-events-none transition-opacity duration-500 ${
          clicked ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </p>
    </div>
  );
}

// ── Punishment data ─────────────────────────────────────────────────────────

const PUNISHMENTS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
    title: "Casual Beeps",
    description: "Gentle beeps that escalate the longer you slouch.",
    severity: "Mild",
    color: "emerald",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
    title: "Fart Sounds",
    description: "Your laptop rips one in the quiet library.",
    severity: "Medium",
    color: "amber",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    title: "AI Coach",
    description: "A custom AI voice roasts your posture.",
    severity: "Spicy",
    color: "orange",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L12 22" /><path d="M5 12l7-10 7 10" />
      </svg>
    ),
    title: "The Needle",
    description: "A servo-powered needle gives you a poke. Real hardware.",
    severity: "Nuclear",
    color: "red",
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const BORDER_COLORS: Record<string, string> = {
  emerald: "border-emerald-200 dark:border-emerald-900/50",
  amber: "border-amber-200 dark:border-amber-900/50",
  orange: "border-orange-200 dark:border-orange-900/50",
  red: "border-red-200 dark:border-red-900/50",
};

const ICON_COLORS: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
};
