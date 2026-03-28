# Codebase Structure

**Analysis Date:** 2026-03-28

## Directory Layout

```
spinesync/
├── .planning/              # GSD planning documents
│   └── codebase/           # Auto-generated codebase analysis
├── ble/                    # BLE (Bluetooth) hardware variant
│   ├── reader.py           # Python BLE client (connects wirelessly to Arduino)
│   ├── see_devices.py      # BLE device scanner utility
│   └── uno.ino             # Arduino firmware for BLE communication
├── serial/                 # USB Serial hardware variant
│   ├── posture_detector.py # Python Serial reader + FastAPI/WebSocket server
│   ├── requirements.txt    # Python deps: pyserial, fastapi, uvicorn
│   ├── serial.ino          # Arduino firmware for Serial communication
│   └── servo_trigger.py    # Interactive servo control test script
├── sounds/                 # Audio assets (fart sound effects, 11 MP3 files)
│   ├── fart-01.mp3 ... fart-08.mp3
│   └── fart-squeak-01.mp3 ... fart-squeak-03.mp3
├── web/                    # Next.js web dashboard (primary application)
│   ├── .env.example        # Environment variable template
│   ├── .gitignore          # Git ignore rules for web/
│   ├── .vscode/            # VS Code workspace settings
│   │   └── settings.json
│   ├── app/                # Next.js App Router pages
│   │   ├── globals.css     # Global styles, CSS variables, animations
│   │   ├── layout.tsx      # Root layout (fonts, metadata)
│   │   └── page.tsx        # Main (and only) page -- composes all components
│   ├── components/         # React UI components
│   │   ├── AngleGauge.tsx  # SVG semicircle gauge showing current angle
│   │   ├── CoachTip.tsx    # AI coaching tip display with fetch button
│   │   ├── Header.tsx      # Sticky header with logo and connection status
│   │   ├── HistoryChart.tsx# Recent activity area chart + minute-bucket bar chart
│   │   ├── LiveChart.tsx   # Real-time 60-second area chart
│   │   ├── StatsRow.tsx    # 4-stat card row (good %, alerts, streak, time)
│   │   └── StatusBanner.tsx# Hero banner showing posture status + angle
│   ├── hooks/              # Custom React hooks (all business logic)
│   │   ├── usePostureSession.ts  # Session analytics, chart data, AI tips
│   │   ├── usePostureStream.ts   # WebSocket connection + reconnection
│   │   └── useVoiceAlert.ts      # ElevenLabs TTS voice alerts
│   ├── lib/                # Shared utilities and types
│   │   ├── constants.ts    # App configuration (thresholds, URLs, messages)
│   │   └── types.ts        # TypeScript interfaces (PostureMessage, etc.)
│   ├── next.config.js      # Next.js configuration (empty/default)
│   ├── package.json        # Node.js dependencies and scripts
│   ├── postcss.config.js   # PostCSS config (tailwindcss + autoprefixer)
│   ├── tailwind.config.ts  # Tailwind CSS theme (custom colors, fonts, shadows)
│   ├── tsconfig.json       # TypeScript config (strict, path aliases)
│   └── server/             # Python backend server
│       ├── main.py         # FastAPI WebSocket server with IMU simulator
│       ├── requirements.txt# Python deps: fastapi, uvicorn, websockets
│       └── venv/           # Python virtual environment (not committed)
└── sample-old-web/         # Deprecated/deleted previous web app (git-tracked deletion)
    ├── .claude/            # Claude settings for old project
    └── .next/              # Build artifacts from old project
```

## Directory Purposes

**`ble/`:**
- Purpose: Wireless BLE communication variant for Arduino connection
- Contains: Arduino firmware (`.ino`), Python BLE client (`reader.py`), BLE scanner utility
- Key files: `ble/uno.ino` (flash once to Arduino), `ble/reader.py` (run on host)
- Status: Functional alternative to serial variant; provides REST-only API (no WebSocket for browser)

**`serial/`:**
- Purpose: USB Serial communication variant for Arduino connection
- Contains: Arduino firmware (`.ino`), Python serial reader with WebSocket server, servo test tool
- Key files: `serial/posture_detector.py` (production serial reader), `serial/serial.ino` (firmware)
- Status: The "real hardware" path; WebSocket-compatible with the web dashboard

**`sounds/`:**
- Purpose: Audio assets -- fart sound effects for posture alerts (humorous/novelty)
- Contains: 11 MP3 files (8 farts, 3 fart-squeaks)
- Status: Not currently wired into the web dashboard; available for future integration

**`web/`:**
- Purpose: Primary application -- Next.js dashboard and Python simulation server
- Contains: Full frontend app + backend server in one directory
- Key sub-dirs: `app/` (pages), `components/` (UI), `hooks/` (logic), `lib/` (shared), `server/` (backend)

**`web/app/`:**
- Purpose: Next.js App Router entry points
- Contains: Root layout, global CSS, single page component
- Key files: `page.tsx` is the entire app's composition root

**`web/components/`:**
- Purpose: Presentational React components
- Contains: 7 components, all client-side (`"use client"`)
- Pattern: Each component is a named export in its own file, receives data via props

**`web/hooks/`:**
- Purpose: All business logic -- data fetching, analytics, side effects
- Contains: 3 hooks forming a dependency chain
- Dependency order: `usePostureStream` -> `usePostureSession` -> (consumed by page)
- `useVoiceAlert` is a standalone side-effect hook

**`web/lib/`:**
- Purpose: Shared type definitions and configuration constants
- Contains: `types.ts` (TypeScript interfaces), `constants.ts` (thresholds, URLs, messages)
- Used by: both hooks and components

**`web/server/`:**
- Purpose: Python FastAPI backend with IMU simulation
- Contains: `main.py` (server), `requirements.txt` (deps), `venv/` (virtual env)
- Runs independently from Next.js (separate process on port 8000)

**`sample-old-web/`:**
- Purpose: Previous iteration of the web app (being deleted/replaced)
- Status: Files deleted in git working tree; only `.claude/` and `.next/` build artifacts remain
- Action: Safe to ignore; will be cleaned up

## Key File Locations

**Entry Points:**
- `web/app/page.tsx`: Browser entry point (single page app)
- `web/app/layout.tsx`: Root HTML layout with fonts and metadata
- `web/server/main.py`: Simulation server entry point (FastAPI app)
- `serial/posture_detector.py`: Real hardware serial server entry point
- `ble/reader.py`: Real hardware BLE server entry point
- `serial/serial.ino`: Arduino serial firmware
- `ble/uno.ino`: Arduino BLE firmware

**Configuration:**
- `web/package.json`: Node.js dependencies and npm scripts
- `web/tsconfig.json`: TypeScript compiler options (strict mode, `@/*` path alias)
- `web/tailwind.config.ts`: Custom theme (colors, fonts, shadows)
- `web/app/globals.css`: CSS variables, animations (glow, shimmer, pulse)
- `web/lib/constants.ts`: App-level constants (thresholds, URLs, timing)
- `web/.env.example`: Environment variable template (WS_URL, API keys)
- `web/server/requirements.txt`: Python server dependencies
- `serial/requirements.txt`: Python serial reader dependencies

**Core Logic:**
- `web/hooks/usePostureStream.ts`: WebSocket connection management, reconnection logic
- `web/hooks/usePostureSession.ts`: Session analytics engine (stats, charts, AI tips)
- `web/hooks/useVoiceAlert.ts`: Voice alert triggering via ElevenLabs
- `web/server/main.py`: IMUSimulator class (fake sensor data generator)

**Presentation:**
- `web/components/StatusBanner.tsx`: Primary status display (good/slouching)
- `web/components/AngleGauge.tsx`: SVG semicircle angle gauge
- `web/components/LiveChart.tsx`: Real-time 60-second chart (recharts)
- `web/components/HistoryChart.tsx`: Session history charts (recharts)
- `web/components/StatsRow.tsx`: Summary statistics cards
- `web/components/Header.tsx`: Navigation header with connection status
- `web/components/CoachTip.tsx`: AI coaching tip display

**Type Definitions:**
- `web/lib/types.ts`: All shared TypeScript interfaces

## Naming Conventions

**Files:**
- React components: PascalCase (`AngleGauge.tsx`, `StatusBanner.tsx`)
- React hooks: camelCase with `use` prefix (`usePostureStream.ts`, `useVoiceAlert.ts`)
- Lib modules: camelCase (`constants.ts`, `types.ts`)
- Python modules: snake_case (`posture_detector.py`, `servo_trigger.py`)
- Arduino firmware: snake_case (`serial.ino`, `uno.ino`)
- CSS: `globals.css` (single file)

**Directories:**
- Lowercase, no separators (`components/`, `hooks/`, `lib/`, `server/`)
- Top-level feature dirs: lowercase (`web/`, `serial/`, `ble/`, `sounds/`)

## Where to Add New Code

**New UI Component:**
- Create file: `web/components/ComponentName.tsx`
- Pattern: Named export, `"use client"` directive, props interface, pure presentational
- Import in: `web/app/page.tsx`
- Style with: Tailwind classes using custom theme tokens from `web/tailwind.config.ts`

**New Custom Hook:**
- Create file: `web/hooks/useHookName.ts`
- Pattern: `"use client"` directive, return typed object
- If it needs session data: consume from `usePostureSession` return value in `page.tsx`
- If it provides data: add to `PostureSession` interface in `web/lib/types.ts`

**New TypeScript Interface:**
- Add to: `web/lib/types.ts`

**New App Constant:**
- Add to: `web/lib/constants.ts`

**New API Endpoint on Simulation Server:**
- Add to: `web/server/main.py` (decorate with `@app.get(...)` or `@app.websocket(...)`)

**New API Endpoint on Serial Server:**
- Add to: `serial/posture_detector.py`

**New Arduino Firmware Variant:**
- Create directory at project root (e.g., `wifi/`)
- Include `.ino` firmware file and Python reader script
- Follow pattern of `serial/` or `ble/` directories

**New Sound Asset:**
- Add MP3 to: `sounds/`

**New Page (if ever needed):**
- Create file: `web/app/[route-name]/page.tsx`
- Current app is single-page; adding routes would require layout changes

## Special Directories

**`web/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `next build` or `next dev`)
- Committed: No (in `.gitignore`)

**`web/server/venv/`:**
- Purpose: Python virtual environment for FastAPI server
- Generated: Yes (by `python -m venv venv`)
- Committed: No (in `.gitignore`)

**`web/node_modules/`:**
- Purpose: Node.js dependency packages
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`sample-old-web/`:**
- Purpose: Deprecated previous web app iteration
- Generated: No
- Committed: Being removed (files show as deleted in git status)
- Action: Will be fully removed; do not add new code here

**`sounds/`:**
- Purpose: Static audio assets
- Generated: No
- Committed: Yes
- Note: Not currently integrated into the web app; potential future feature

---

*Structure analysis: 2026-03-28*
