import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#07070f",
          surface: "#0f0f1a",
          card: "#13131f",
        },
        border: {
          DEFAULT: "#1e1e32",
          bright: "#2a2a45",
        },
        accent: {
          green: "#00ff88",
          "green-dim": "rgba(0, 255, 136, 0.125)",
          amber: "#f59e0b",
          "amber-dim": "rgba(245, 158, 11, 0.125)",
          red: "#ef4444",
          "red-dim": "rgba(239, 68, 68, 0.125)",
        },
        text: {
          primary: "#ffffff",
          secondary: "#8888aa",
          tertiary: "#44445a",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      boxShadow: {
        "green-glow": "0 0 30px rgba(0, 255, 136, 0.25)",
        "amber-glow": "0 0 30px rgba(245, 158, 11, 0.25)",
        "red-glow": "0 0 30px rgba(239, 68, 68, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
