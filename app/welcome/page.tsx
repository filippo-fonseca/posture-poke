"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { SpineDecoration } from "@/components/SpineDecoration";

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const stats = [
  { value: "80%", label: "of Americans will experience back pain in their lifetime" },
  { value: "65%", label: "of college students report back/neck pain from studying" },
  { value: "$100B+", label: "spent annually on back pain treatment in the US" },
  { value: "#1", label: "cause of disability worldwide for people under 50" },
];

const punishments = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
    title: "Casual Beeps",
    description: "Gentle beeps that get progressively more annoying the longer you slouch. Starts polite. Doesn't stay polite.",
    severity: "Mild",
    color: "emerald",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
    title: "Fart Sounds",
    description: "Your laptop rips one in the middle of a quiet library. Sit up or suffer the social consequences.",
    severity: "Medium",
    color: "amber",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    title: "AI Coach",
    description: "Design your own unhinged posture coach. Sassy grandma? Drill sergeant? British butler? It roasts you in their voice.",
    severity: "Spicy",
    color: "orange",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L12 22" /><path d="M5 12l7-10 7 10" /><circle cx="12" cy="22" r="0" />
      </svg>
    ),
    title: "The Poker",
    description: "A tiny servo-powered poker gives you a gentle poke. Real hardware. Real motivation. Real consequences.",
    severity: "Nuclear",
    color: "red",
  },
];

const severityColors: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const borderColors: Record<string, string> = {
  emerald: "border-emerald-200 dark:border-emerald-900/50",
  amber: "border-amber-200 dark:border-amber-900/50",
  orange: "border-orange-200 dark:border-orange-900/50",
  red: "border-red-200 dark:border-red-900/50",
};

const iconColors: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
};

export default function Landing() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const appHref = user ? "/" : "/login";

  return (
    <div className="min-h-screen flex flex-col">
      <SpineDecoration />
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <img src="/logo.svg" alt="" className="h-7 w-7 dark:invert" />
              PosturePoke
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={toggle}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <motion.div
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center"
          >
            <motion.div
              custom={0}
              variants={fade}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">YHack 2026 &middot; Hardware Track</span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fade}
              className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              Watch your back.
            </motion.h1>

            <motion.p
              custom={2}
              variants={fade}
              className="mt-4 max-w-xl text-lg text-zinc-500 dark:text-zinc-400 sm:text-xl"
            >
              Bad posture is a real health crisis. We made fixing it genuinely fun — with escalating consequences you actually want to avoid.
            </motion.p>

            <motion.div
              custom={3}
              variants={fade}
              className="mt-8 flex flex-col sm:flex-row items-center gap-3"
            >
              <Link
                href={appHref}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
              >
                {user ? "Go to Dashboard" : "Get Started"}
              </Link>
              <a
                href="#how-it-works"
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                See How It Works
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-10"
            >
              <motion.h2 custom={0} variants={fade} className="text-2xl font-bold tracking-tight sm:text-3xl">
                The problem is bigger than you think
              </motion.h2>
              <motion.p custom={1} variants={fade} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
                Poor posture isn&apos;t just uncomfortable — it&apos;s a chronic health epidemic hiding in plain sight.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.value}
                  custom={i}
                  variants={fade}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
                >
                  <span className="font-mono text-2xl font-medium text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                    {stat.value}
                  </span>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Student impact */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-8 lg:grid-cols-2 items-center"
          >
            <div>
              <motion.span
                custom={0}
                variants={fade}
                className="inline-block rounded-full bg-red-100 dark:bg-red-950/30 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400 mb-4"
              >
                Especially dangerous for students
              </motion.span>
              <motion.h2 custom={1} variants={fade} className="text-2xl font-bold tracking-tight sm:text-3xl">
                Hours hunched over laptops are wrecking your spine
              </motion.h2>
              <motion.p custom={2} variants={fade} className="mt-4 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                The average college student spends 8-10 hours a day sitting — in lectures, libraries, and dorms.
                That&apos;s thousands of hours per year training your body into a C-shape.
                The result? Chronic neck pain, tension headaches, reduced lung capacity, and long-term spinal damage
                that compounds over decades.
              </motion.p>
              <motion.p custom={3} variants={fade} className="mt-3 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Traditional posture solutions are boring, so people ignore them. We took a different approach:
                make the consequences of bad posture so ridiculous that you <span className="italic">have</span> to sit up straight.
              </motion.p>
            </div>

            <motion.div
              custom={2}
              variants={fade}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { val: "8-10h", desc: "average daily sitting time for students" },
                { val: "53%", desc: "of students report posture-related pain" },
                { val: "3x", desc: "more neck strain vs 20 years ago" },
                { val: "21", desc: "average age chronic back issues now start" },
              ].map((s) => (
                <div
                  key={s.val}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4"
                >
                  <span className="font-mono text-xl font-medium text-red-600 dark:text-red-400">
                    {s.val}
                  </span>
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* How it works — escalation levels */}
        <section id="how-it-works" className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-12"
            >
              <motion.h2 custom={0} variants={fade} className="text-2xl font-bold tracking-tight sm:text-3xl">
                Four levels of motivation
              </motion.h2>
              <motion.p custom={1} variants={fade} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Pick your punishment. Each escalation level makes ignoring bad posture a little harder.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid gap-4 sm:grid-cols-2"
            >
              {punishments.map((p, i) => (
                <motion.div
                  key={p.title}
                  custom={i}
                  variants={fade}
                  className={`rounded-lg border ${borderColors[p.color]} bg-white dark:bg-zinc-900 p-6 flex flex-col`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={iconColors[p.color]}>{p.icon}</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${severityColors[p.color]}`}>
                      {p.severity}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
                    {p.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How it works — tech */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-12"
          >
            <motion.h2 custom={0} variants={fade} className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-px bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden sm:grid-cols-3"
          >
            {[
              {
                step: "01",
                title: "Clip it on",
                desc: "Attach the tiny sensor to your shirt collar. It measures your spine angle 20 times per second.",
              },
              {
                step: "02",
                title: "Set your consequences",
                desc: "Choose what happens when you slouch — from beeps to an AI-generated voice coach to... the poker.",
              },
              {
                step: "03",
                title: "Sit better (or else)",
                desc: "Real-time monitoring with a live dashboard. Slouch too long and your chosen punishment kicks in.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                variants={fade}
                className="bg-white dark:bg-zinc-950 p-6 sm:p-8"
              >
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{s.step}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <motion.h2 custom={0} variants={fade} className="text-2xl font-bold tracking-tight sm:text-3xl">
                Your spine called. It wants better posture.
              </motion.h2>
              <motion.p custom={1} variants={fade} className="mt-3 text-zinc-500 dark:text-zinc-400">
                Sign in with Google and start a session.
              </motion.p>
              <motion.div custom={2} variants={fade} className="mt-6">
                <Link
                  href={appHref}
                  className="inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 px-8 py-3 text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
                >
                  {user ? "Go to Dashboard" : "Get Started"}
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-6">
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          PosturePoke — YHack 2026 Hardware Track
        </p>
      </footer>
    </div>
  );
}
