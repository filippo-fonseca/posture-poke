# Claude Code Prompt — SpineSync MVP (YHack Hardware 2026)

## Context

You are building **SpineSync** — a real-time posture coaching web app for a wearable hardware hackathon project at YHack. The hardware is an Arduino Nano 33 BLE Sense Rev2 strapped to the user's upper back. It reads spine angle via its built-in BMI270 IMU and streams data over BLE.

**The hardware hasn't arrived yet.** The architecture is designed so the web app works perfectly right now with simulated data, and the moment the Arduino is plugged in, one Python file change swaps simulation for real sensor data. The Next.js app never changes.

Brand:

- Name: **SpineSync**
- Tagline: **"we got your back. literally."**
- Vibe: dark, premium, data-dense — Vercel meets Whoop meets Linear. Funded startup, not a hackathon prototype.

---

## Full System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│         Next.js App (React + TypeScript)            │
│         Connects via WebSocket to localhost:8000    │
└─────────────────────┬───────────────────────────────┘
                      │ WebSocket ws://localhost:8000/ws
                      │ JSON messages: { delta: 23.4, timestamp: 1234567890 }
┌─────────────────────▼───────────────────────────────┐
│           Python FastAPI Server (local)             │
│                                                     │
│   NOW:  simulate_imu() — generates realistic        │
│         fake IMU angle data mimicking the           │
│         Arduino Nano 33 BLE Sense Rev2 BMI270       │
│                                                     │
│   LATER: read_arduino() — reads from serial port   │
│          or BLE when hardware arrives               │
│          ONE function swap, nothing else changes    │
└─────────────────────────────────────────────────────┘
```

This means:

- The Next.js app is **identical** whether using simulation or real hardware
- The Python server is the only thing that changes when hardware arrives
- No Web Bluetooth complexity in the browser — cleaner, more reliable demo
- Works on any OS, any browser, no Bluetooth permission headaches

---

## Part 1 — Python FastAPI WebSocket Server

### File: `server/main.py`

Build a FastAPI server with a WebSocket endpoint at `/ws`. It streams posture data as JSON at 20Hz (every 50ms).

```python
# Message format sent to browser:
{
  "delta": 23.4,        # float: degrees off baseline (0 = perfect, >20 = slouching)
  "timestamp": 1234567  # int: unix ms timestamp
}

# Command format received from browser:
{
  "command": "calibrate"  # resets baseline (no-op in simulation)
}
```

### Simulation function — must mirror real IMU behavior exactly

The simulation must feel like a real BMI270 IMU on someone's back. Implement this behavior:

```python
import math, random, time

class IMUSimulator:
    """
    Simulates the BMI270 accelerometer on Arduino Nano 33 BLE Sense Rev2.

    Real IMU behavior this mirrors:
    - Baseline noise: ±1-2° even when sitting perfectly still (sensor noise)
    - Good posture: 0-8° delta, slow drift
    - Slouch transition: gradual over 3-5 seconds, not instant
    - Slouch depth: typically 20-45° when bad
    - Recovery: user corrects over 1-2 seconds when alerted
    - Natural variation: small oscillations from breathing (~0.5° amplitude, ~0.25Hz)
    - Occasional micro-movements: typing, shifting in seat
    """

    def __init__(self):
        self.current_angle = 3.0
        self.target_angle = 3.0
        self.phase = "good"  # "good" | "transitioning_bad" | "bad" | "recovering"
        self.phase_timer = 0
        self.phase_duration = random.uniform(15, 45)  # seconds in current phase
        self.breath_phase = 0.0
        self.noise_seed = random.random() * 1000

    def tick(self, dt: float) -> float:
        """Call every 50ms, returns current angle delta in degrees."""
        self.phase_timer += dt
        self.breath_phase += dt * 2 * math.pi * 0.25  # 0.25Hz breathing

        # State machine: realistic posture patterns
        if self.phase_timer >= self.phase_duration:
            self._transition_phase()

        # Move toward target (realistic inertia)
        diff = self.target_angle - self.current_angle
        self.current_angle += diff * min(dt * 0.8, 1.0)

        # Add breathing oscillation
        breathing = math.sin(self.breath_phase) * 0.5

        # Add sensor noise (BMI270 has ~0.1° noise floor, amplified by mount)
        noise = (random.random() - 0.5) * 1.5

        return max(0.0, self.current_angle + breathing + noise)

    def _transition_phase(self):
        self.phase_timer = 0
        if self.phase == "good":
            # 35% chance to start slouching
            if random.random() < 0.35:
                self.phase = "transitioning_bad"
                self.target_angle = random.uniform(25, 42)
                self.phase_duration = random.uniform(3, 6)  # transition takes 3-6s
            else:
                self.target_angle = random.uniform(2, 8)
                self.phase_duration = random.uniform(10, 40)
        elif self.phase == "transitioning_bad":
            self.phase = "bad"
            self.phase_duration = random.uniform(8, 30)  # slouch for 8-30s
        elif self.phase == "bad":
            self.phase = "recovering"
            self.target_angle = random.uniform(2, 6)
            self.phase_duration = random.uniform(1, 3)  # recover in 1-3s
        elif self.phase == "recovering":
            self.phase = "good"
            self.phase_duration = random.uniform(15, 50)
```

### Dependencies: `server/requirements.txt`

```
fastapi==0.109.0
uvicorn==0.27.0
websockets==12.0
```

### Run command:

```bash
cd server && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

### LATER — real Arduino swap (document this clearly in the file):

```python
# TO SWAP TO REAL HARDWARE:
# 1. pip install pyserial
# 2. Replace the simulator loop with:
#
# import serial
# ser = serial.Serial('/dev/tty.usbmodem1101', 115200)  # adjust port
# while True:
#     line = ser.readline().decode().strip()
#     delta = float(line)
#     yield delta
#
# The Arduino firmware prints one float per line over Serial.
# WebSocket message format stays identical — browser never changes.
```

---

## Part 2 — Next.js Web App

### Tech Stack

- **Next.js latest version** App Router
- **TypeScript** strict mode
- **Tailwind CSS**
- **Recharts** for all charts
- **Framer Motion** for animations
- Google Fonts: **Space Grotesk** (headings) + **DM Mono** (numbers/data)

### WebSocket Hook: `hooks/usePostureStream.ts`

```typescript
// Connects to ws://localhost:8000/ws
// Handles reconnection automatically (retry every 2s if disconnected)
// Exposes:
interface UsePostureStream {
  isConnected: boolean;
  currentDelta: number;
  lastTimestamp: number | null;
  sendCalibrate: () => void;
}
```

Auto-reconnect logic: if WebSocket closes, wait 2 seconds and reconnect. Show "Reconnecting..." status in UI. This is critical for demo reliability.

### Session Hook: `hooks/usePostureSession.ts`

Consumes `usePostureStream` and builds all session statistics:

```typescript
interface PostureSession {
  // Connection
  isConnected: boolean;

  // Live data
  currentDelta: number; // current angle in degrees
  isSlouchingNow: boolean; // delta > SLOUCH_THRESHOLD (20°)
  currentSlouchDuration: number; // seconds in current slouch (0 if good)
  currentStreakDuration: number; // seconds in current good streak

  // Chart data — last 60 readings (1 per second, downsampled from 20Hz)
  liveChartData: {
    time: string; // "0:45"
    delta: number;
    threshold: number; // always 20, for the reference line
  }[];

  // Session stats
  sessionDuration: number; // total seconds connected
  goodPct: number; // % of session in good posture
  alertCount: number; // times crossed threshold
  bestStreak: number; // longest good streak in seconds

  // History — 1-minute buckets
  minuteBuckets: {
    label: string; // "0–1m", "1–2m" etc.
    goodPct: number; // 0–100
    totalReadings: number;
  }[];

  // AI coach
  currentTip: string;
  isFetchingTip: boolean;
  lastTipFetchedAt: number | null;

  // Actions
  calibrate: () => void;
  fetchTip: () => void;
}

const SLOUCH_THRESHOLD = 20; // degrees
const ALERT_COOLDOWN = 60; // seconds between voice alerts
const TIP_TRIGGER_DURATION = 30; // seconds of slouching before fetching tip
```

### ElevenLabs Hook: `hooks/useVoiceAlert.ts`

```typescript
// Triggers when isSlouchingNow && currentSlouchDuration >= 10
// Cooldown: 60 seconds between alerts
// Voice ID: "21m00Tcm4TlvDq8ikWAM" (Rachel)
// Message varies based on duration:
//   10s:  "Heads up — you're starting to slouch. Roll those shoulders back."
//   30s:  "You've been slouching for 30 seconds. Time to sit up straight."
//   60s:  "Still slouching. Take a breath, reset your posture."
// Uses fetch to ElevenLabs API, plays audio via Web Audio API
// API key from NEXT_PUBLIC_ELEVENLABS_API_KEY env var
// Gracefully fails silently if no API key set
```

### Claude Hook: `hooks/useCoachTip.ts`

```typescript
// Fetches tip when: currentSlouchDuration >= 30 and lastTipFetchedAt is null
//   or > 60 seconds ago
// Prompt:
//   "You are SpineSync, a smart posture coach. The user has been slouching
//    for {N} seconds with a spine angle {X}° off their baseline. Give one
//    short actionable tip, max 15 words, no intro, direct and human."
// Model: claude-opus-4-5
// max_tokens: 60
// API key from NEXT_PUBLIC_ANTHROPIC_API_KEY env var
// Gracefully fails silently if no API key — shows default tip
```

---

## Part 3 — UI Components

### Visual Design System

```css
/* globals.css — CSS variables */
:root {
  --bg-base: #07070f;
  --bg-surface: #0f0f1a;
  --bg-card: #13131f;
  --border: #1e1e32;
  --border-bright: #2a2a45;

  --green: #00ff88;
  --green-dim: #00ff8820;
  --green-glow: 0 0 30px #00ff8840;

  --amber: #f59e0b;
  --amber-dim: #f59e0b20;
  --amber-glow: 0 0 30px #f59e0b40;

  --red: #ef4444;
  --red-dim: #ef444420;
  --red-glow: 0 0 30px #ef444440;

  --text-primary: #ffffff;
  --text-secondary: #8888aa;
  --text-tertiary: #44445a;

  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "DM Mono", monospace;
}
```

### Component Specs

#### `Header.tsx`

- Left: SpineSync wordmark (Space Grotesk, bold, white) + tagline below in secondary color
- Right: WebSocket connection status pill + session timer
- Status pill states: gray "No Signal", yellow pulsing "Connecting...", green "Live · 0:00:00"
- Thin border bottom, sticky

#### `StatusBanner.tsx`

This is the hero element — large, dramatic, changes the feel of the entire page:

Good posture state:

- Background: very dark green tint (`#00ff8808`)
- Left border: 3px solid `var(--green)`
- Box shadow: `var(--green-glow)` — subtle outer glow
- Large angle number: `0.0°` in DM Mono, green
- Status text: "Perfect alignment" or "Looking good" in white, large
- Sub text: "in good posture for 4m 32s" in secondary
- Subtle breathing pulse animation on the glow

Slouching state:

- Background: dark red tint (`#ef444408`)
- Left border: 3px solid `var(--red)`
- Box shadow: `var(--red-glow)` — more intense, grabs attention
- Large angle number: "34.2°" in red, slightly larger
- Status text: "Sit up straight" in white, large
- Sub text: "slouching for 8 seconds"
- Glow pulses faster/more intensely than good state

Transition between states: 400ms CSS transition on all color/shadow properties.

#### `AngleGauge.tsx`

Custom SVG arc gauge (do NOT use a library for this — build it with SVG):

- Semicircle arc from 180° to 0° (left to right)
- Arc background: dark gray
- Arc fill: animates from 0 to current value
  - 0–20°: green fill
  - 20–35°: amber fill
  - 35°+: red fill
- Center: large number showing current delta (DM Mono)
- Below number: "degrees off baseline" label
- Zone markers: small tick marks at 20° and 35° with labels "Good", "Warning", "Poor"
- Smooth animation: CSS transition 200ms on arc fill

#### `LiveChart.tsx`

Recharts AreaChart, last 60 seconds of data:

- Dark background, no chart border
- X axis: time labels every 10s, secondary color
- Y axis: 0–50°, secondary color
- Reference line at y=20: dashed, labeled "Slouch threshold"
- Area fill: use two areas — one green (below threshold) one red (above)
  - Achieve this with `<defs>` linearGradient that transitions at y=20
  - Or use two separate areas with clip paths
- Line: 2px, color matches current state
- Dot: none (too noisy at this frequency)
- Tooltip: dark card, shows "23.4° at 0:42"
- Updates every second — new point added, oldest removed
- `isAnimationActive={false}` for performance (data updates too fast for animation)

#### `StatsRow.tsx`

Four `StatCard` components in a responsive grid (2x2 on mobile, 4x1 on desktop):

Each StatCard:

- Dark card background, subtle border
- Large value (DM Mono, 28px)
- Label below (secondary color, 12px)
- Value color changes based on threshold (good/warning/bad)
- Subtle count-up animation when value changes

Cards:

1. **Good Posture** — `{goodPct}%` — green ≥70, amber ≥50, red <50
2. **Alerts** — `{alertCount}` — counts slouch threshold crossings
3. **Best Streak** — `{bestStreak}` formatted as "4m 32s"
4. **Session Time** — live timer, always white

#### `HistoryChart.tsx`

This is the most important chart — shows posture quality over time.

Recharts BarChart:

- Each bar = 1-minute bucket of session
- Bar height = % of that minute in good posture
- Bar color:
  - ≥80%: `var(--green)`
  - ≥50%: `var(--amber)`
  - <50%: `var(--red)`
- X axis: "0–1m", "1–2m" etc.
- Y axis: 0–100%, labeled "%"
- Custom tooltip: dark card showing "Minute 1–2: 73% good posture"
- Bars animate in on first render (Recharts default animation)
- Empty state (no data yet): centered text "Start a session to see your posture history" with a subtle spine/back icon drawn in SVG

#### `CoachTip.tsx`

- Card with subtle left border in amber
- Top: "AI Coach" label with small sparkle/star icon
- Main: tip text in white, 16px, line-height 1.6
- If fetching: animated shimmer skeleton
- Bottom: "New tip →" button, text-only, secondary color
- Tip animates in with fade + slight upward translate on change

---

## Part 4 — Dashboard Layout

### `app/page.tsx`

```
┌─────────────────────────────────────────┐
│              Header (sticky)            │
├─────────────────────────────────────────┤
│           StatusBanner (hero)           │
├──────────────────┬──────────────────────┤
│   AngleGauge     │     LiveChart        │
│   (left third)   │   (right two-thirds) │
├──────────────────┴──────────────────────┤
│              StatsRow (4 cards)         │
├─────────────────────────────────────────┤
│           HistoryChart (full width)     │
├──────────────────┬──────────────────────┤
│   CoachTip       │   [future: alerts]   │
│   (left half)    │   placeholder card   │
└──────────────────┴──────────────────────┘
```

Page background: `var(--bg-base)` with a very subtle radial gradient centered top — slightly lighter in the center, fading to almost black at edges. Adds depth without being distracting.

---

## Part 5 — Environment & Setup

### `.env.local`

```
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_key_here
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

### `README.md` — include this exactly:

```markdown
# SpineSync — we got your back. literally.

## Quick Start

### 1. Start the data server

cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

### 2. Start the web app

npm install
npm run dev

### 3. Open http://localhost:3000

The app runs in simulation mode by default — realistic fake IMU data.

## Connecting Real Hardware (when Arduino arrives)

1. Flash the Arduino firmware (see /firmware/posture_coach.ino)
2. Plug Arduino into laptop via USB
3. In server/main.py, replace the simulator with the serial reader:
   Uncomment the serial section, update the port, restart uvicorn.
4. Everything else stays the same.

## Environment Variables

Copy .env.example to .env.local and fill in API keys.
ElevenLabs and Claude keys are optional — app works without them,
just without voice alerts and AI tips.
```

---

## Build Order (follow this exactly)

1. **Python server first** (`server/main.py`) — get WebSocket streaming working, test with `wscat` or browser console
2. **Types and constants** (`lib/types.ts`, `lib/constants.ts`)
3. **WebSocket hook** (`hooks/usePostureStream.ts`) — connect to server, log raw data to console
4. **Session hook** (`hooks/usePostureSession.ts`) — build all stats on top of raw stream
5. **Layout and design system** (`app/layout.tsx`, `globals.css`) — fonts, CSS vars, base styles
6. **StatusBanner** — most impactful component, build it first
7. **StatsRow + StatCard** — straightforward, builds confidence
8. **LiveChart** — real-time Recharts AreaChart
9. **AngleGauge** — custom SVG, takes most care
10. **HistoryChart** — Recharts BarChart with colored bars
11. **CoachTip** — fetch logic + display
12. **Header** — polish and connection status
13. **Voice alerts** (`hooks/useVoiceAlert.ts`) — ElevenLabs integration last

---

## What Wins This Hackathon

- **Real sensor data pipeline** — even simulated, the architecture is production-grade
- **Voice coaching via ElevenLabs** — the app literally talks to you, sponsor loves it
- **Posture history chart** — not just "right now" but your pattern over time
- **AI tips from Claude** — personalized, not canned messages
- **It looks like a funded startup** — dark, premium, fast, intentional

Make every pixel count. The demo is 2 minutes in front of judges. This needs to be unforgettable.
