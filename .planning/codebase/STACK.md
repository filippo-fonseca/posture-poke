# Technology Stack

**Analysis Date:** 2026-03-28

## Languages

**Primary:**
- TypeScript ~5 - Web frontend (`web/app/`, `web/components/`, `web/hooks/`, `web/lib/`)
- Python 3.14 - Backend server and hardware scripts (`web/server/`, `serial/`, `ble/`)

**Secondary:**
- C++ (Arduino) - Microcontroller firmware (`serial/serial.ino`, `ble/uno.ino`)
- CSS - Tailwind-based styling (`web/app/globals.css`)

## Runtime

**Frontend:**
- Node.js (version unspecified, uses Next.js 16 which requires Node 18.18+)
- Browser WebSocket API for real-time data

**Backend:**
- Python 3.14 (confirmed from venv at `web/server/venv/lib/python3.14/`)
- Uvicorn ASGI server

**Firmware:**
- Arduino runtime targeting Arduino Nano 33 BLE Sense Rev2

**Package Managers:**
- npm - Frontend dependencies. Lockfile: `web/package-lock.json` present
- pip - Python dependencies. No lockfile (uses plain `requirements.txt`)

## Frameworks

**Core:**
- Next.js ^16.2.0 - React meta-framework with App Router (`web/package.json`)
- React ^19.2.4 - UI library (`web/package.json`)
- FastAPI 0.109.0 - Python async web server with WebSocket support (`web/server/requirements.txt`, `serial/requirements.txt`)

**Styling:**
- Tailwind CSS ^3.4.1 - Utility-first CSS (`web/tailwind.config.ts`)
- PostCSS ^8.4.33 + Autoprefixer ^10.4.17 - CSS processing pipeline (`web/postcss.config.js`)

**Animation:**
- Framer Motion ^11.0.0 - React animation library used in all UI components

**Charting:**
- Recharts ^2.12.0 - React charting library for live and historical posture data (`web/components/LiveChart.tsx`, `web/components/HistoryChart.tsx`)

**Testing:**
- Not detected. No test framework is configured or installed.

**Build/Dev:**
- Next.js built-in bundler (Turbopack/Webpack) - No custom build config (`web/next.config.js` is empty)
- ESLint ^8 + eslint-config-next 14.1.0 - Linting (`web/package.json`)

## Key Dependencies

**Critical (Frontend):**
- `next` ^16.2.0 - App framework, handles routing, SSR, bundling
- `react` ^19.2.4 - Component rendering
- `react-dom` ^19.2.4 - DOM rendering
- `recharts` ^2.12.0 - All chart visualizations (AreaChart, BarChart)
- `framer-motion` ^11.0.0 - Animations for status transitions, gauge, banners

**Critical (Backend):**
- `fastapi` 0.109.0 - WebSocket server and REST endpoints (`web/server/main.py`, `serial/posture_detector.py`)
- `uvicorn` 0.27.0 - ASGI server to run FastAPI (`web/server/requirements.txt`)
- `websockets` 12.0 - WebSocket protocol support for FastAPI (`web/server/requirements.txt`)
- `pyserial` >=3.5 - Serial communication with Arduino hardware (`serial/requirements.txt`)

**Critical (BLE):**
- `bleak` (version unspecified in requirements but imported in `ble/reader.py`) - Bluetooth Low Energy client for wireless Arduino communication

**Dev Dependencies (Frontend):**
- `@types/node` ^20 - Node.js type definitions
- `@types/react` ^18 - React type definitions (note: mismatched with React 19)
- `@types/react-dom` ^18 - React DOM type definitions (note: mismatched with React 19)
- `typescript` ^5 - TypeScript compiler
- `autoprefixer` ^10.4.17 - CSS vendor prefixing
- `postcss` ^8.4.33 - CSS processing
- `tailwindcss` ^3.4.1 - Utility CSS framework
- `eslint` ^8 - Code linting
- `eslint-config-next` 14.1.0 - Next.js ESLint preset (note: version 14 vs Next.js 16)

## Configuration

**TypeScript:**
- Config: `web/tsconfig.json`
- Strict mode enabled
- Module resolution: `bundler`
- JSX: `react-jsx`
- Path alias: `@/*` maps to `web/*`
- Target: ES2017

**Tailwind CSS:**
- Config: `web/tailwind.config.ts`
- Custom dark theme with design tokens: `bg-base`, `bg-surface`, `bg-card`, `accent-green`, `accent-amber`, `accent-red`
- Custom fonts: `Space Grotesk` (display), `DM Mono` (monospace) loaded via `next/font/google` in `web/app/layout.tsx`
- Glow box shadows: `green-glow`, `amber-glow`, `red-glow`

**PostCSS:**
- Config: `web/postcss.config.js`
- Plugins: `tailwindcss`, `autoprefixer`

**Next.js:**
- Config: `web/next.config.js` - Empty (default configuration)

**Environment:**
- `.env.example` at `web/.env.example` defines three vars:
  - `NEXT_PUBLIC_WS_URL` - WebSocket server URL (default: `ws://localhost:8000/ws`)
  - `NEXT_PUBLIC_ELEVENLABS_API_KEY` - Optional, for voice alerts
  - `NEXT_PUBLIC_ANTHROPIC_API_KEY` - Optional, for AI coaching tips
- All env vars are `NEXT_PUBLIC_*` (client-side accessible)

**Arduino:**
- Serial baud rate: 115200
- IMU sensor: BMI270 (via `Arduino_BMI270_BMM150.h`)
- BLE library: `ArduinoBLE.h`
- Data format over serial: `pitch,roll\n` (CSV, 2 floats)
- Data format over BLE: 8-byte binary packet `[float32 pitch, float32 roll]`
- Update rate: 10 Hz (100ms interval)

## Platform Requirements

**Development:**
- macOS (current dev environment is Darwin 23.4.0)
- Node.js 18.18+ (required by Next.js 16)
- Python 3.14
- Arduino IDE or compatible toolchain (for firmware flashing)
- USB connection to Arduino (for serial mode) or Bluetooth (for BLE mode)

**Production:**
- The web app targets Vercel (`.vercel` in `.gitignore`)
- The Python backend runs locally only (requires physical proximity to hardware)
- No containerization or cloud deployment configuration detected

## Scripts

**Frontend (`web/package.json`):**
```bash
npm run dev      # Start Next.js dev server (port 3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

**Backend:**
```bash
# Simulation mode (no hardware)
cd web/server && uvicorn main:app --reload --port 8000

# Serial mode (USB-connected Arduino)
cd serial && python posture_detector.py [--port /dev/tty.usbmodemXXXX]

# BLE mode (wireless Arduino)
cd ble && python reader.py
```

## Audio Assets

- `sounds/` directory contains 11 MP3 files (fart sound effects, ~55-162KB each)
- These appear to be novelty alert sounds, not currently wired into the web app
- Current voice alerts use ElevenLabs TTS API instead

---

*Stack analysis: 2026-03-28*
