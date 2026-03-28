# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Three-tier IoT architecture -- hardware sensor (Arduino), Python middleware server, React web dashboard -- connected via USB Serial or BLE for hardware-to-server, and WebSocket for server-to-browser.

**Key Characteristics:**
- Real-time streaming architecture (20Hz server-to-browser via WebSocket, 10Hz hardware-to-server via Serial/BLE)
- Stateless server with in-memory shared state (no database)
- Client-side session analytics (all stats computation happens in the browser)
- Hardware abstraction: the server can run in simulation mode (no Arduino required) or real hardware mode (Serial or BLE)
- Single-page application with no routing

## System Components

### 1. Arduino Firmware (Hardware Layer)

**Purpose:** Read BMI270 accelerometer, compute pitch/roll angles, transmit to host.

**Two variants exist:**

**Serial variant** (`serial/serial.ino`):
- Reads BMI270 accelerometer at 10Hz
- Computes pitch and roll from raw acceleration using `atan2`
- Sends comma-separated `"pitch,roll\n"` over USB Serial at 115200 baud
- LED status: solid = ready, fast blink = IMU init failure

**BLE variant** (`ble/uno.ino`):
- Same IMU reading and pitch/roll computation
- Broadcasts as BLE peripheral named "PostureDetector"
- Custom BLE service UUID `19B10000-E8F2-537E-4F6C-D104768A1214`
- Tilt characteristic UUID `19B10001-...` sends 8-byte packet (two float32: pitch + roll) via BLE notify
- Includes watchdog: resets BLE stack if no data sent for 5 seconds while connected
- Full BLE teardown and reinit on disconnect for reliability

### 2. Python Middleware Server (Server Layer)

**Purpose:** Bridge between hardware and web browser. Exposes WebSocket `/ws` endpoint.

**Three variants exist:**

**Simulation server** (`web/server/main.py`) -- PRIMARY, currently in use:
- FastAPI app with `IMUSimulator` class generating realistic fake IMU data
- Simulates posture phases: good -> transitioning_bad -> bad -> recovering
- Includes breathing oscillation (0.25Hz, 0.5deg amplitude) and sensor noise
- Streams at 20Hz over WebSocket
- Accepts `{"command": "calibrate"}` messages from client
- Global simulator shared across all WebSocket connections
- Endpoints: `GET /` (status), `GET /health`, `WS /ws`

**Serial reader** (`serial/posture_detector.py`):
- Reads real Arduino data over USB Serial in a background thread
- Auto-detects Arduino port via `serial.tools.list_ports`
- `ConnectionManager` class manages multiple WebSocket connections
- Converts raw pitch/roll to delta (deviation from calibration baseline)
- Streams at 10Hz over WebSocket
- Supports calibration: sets baseline to current reading position
- REST endpoint: `GET /tilt` returns latest reading
- CLI args: `--port`, `--baud`, `--api-port`, `--no-api`

**BLE reader** (`ble/reader.py`):
- Connects to Arduino over Bluetooth using `bleak` library
- Scans for device by name "PostureDetector" and service UUID
- Receives 8-byte BLE notifications, unpacks two float32 values
- Auto-reconnects on disconnect
- REST only (no WebSocket): `GET /tilt`, `GET /health`
- BLE loop runs in separate thread with its own asyncio event loop

### 3. Next.js Web Dashboard (Client Layer)

**Purpose:** Real-time posture monitoring UI with analytics, coaching, and voice alerts.

**Location:** `web/`

**Architecture pattern:** Single-page app using React hooks for all state management. No external state management library. All session data is computed and stored client-side.

## Layers (Web Dashboard Detail)

**Presentation Layer:**
- Purpose: Render UI components with real-time data
- Location: `web/components/`
- Contains: 7 presentational React components, all marked `"use client"`
- Depends on: hooks layer for data, recharts for charts, framer-motion for animations
- Components are pure presentational -- receive data via props, no direct data fetching

**Hooks Layer:**
- Purpose: Business logic, WebSocket management, session analytics
- Location: `web/hooks/`
- Contains: 3 custom hooks that compose into a layered data pipeline
- `usePostureStream` (lowest level): WebSocket connection, reconnection, raw data
- `usePostureSession` (mid level): consumes `usePostureStream`, computes all session stats
- `useVoiceAlert` (side effect): consumes session data, triggers ElevenLabs TTS

**Shared Layer:**
- Purpose: Type definitions and configuration constants
- Location: `web/lib/`
- Contains: TypeScript interfaces (`types.ts`) and app constants (`constants.ts`)
- Used by: hooks and components

**App Layer:**
- Purpose: Next.js entry points (layout, page)
- Location: `web/app/`
- Contains: root layout with font setup, single page component that composes everything

## Data Flow

**Primary Data Flow (Simulation Mode):**

1. `IMUSimulator.tick()` in `web/server/main.py` generates a delta angle every 50ms
2. Server sends `{"delta": number, "timestamp": number}` JSON over WebSocket at 20Hz
3. `usePostureStream` hook in `web/hooks/usePostureStream.ts` receives messages, updates `currentDelta` and `lastTimestamp` state
4. `usePostureSession` hook in `web/hooks/usePostureSession.ts` processes each reading:
   - Classifies as good/slouching based on `SLOUCH_THRESHOLD` (20 degrees)
   - Buffers readings in `deltaBufferRef`, downsamples to 1Hz for charts
   - Updates running stats: `goodPct`, `alertCount`, `bestStreak`, `minuteBuckets`
5. Components re-render with new data via props passed from `web/app/page.tsx`

**Calibration Flow:**

1. User clicks "Recalibrate Baseline" button in `web/app/page.tsx`
2. `session.calibrate` calls `sendCalibrate()` from `usePostureStream`
3. WebSocket sends `{"command": "calibrate"}` to server
4. Server resets simulator state (simulation) or resamples baseline pitch/roll (real hardware)

**Voice Alert Flow:**

1. `useVoiceAlert` hook in `web/hooks/useVoiceAlert.ts` monitors `isSlouchingNow` and `currentSlouchDuration`
2. At 10s, 30s, 60s thresholds of continuous slouching, triggers a voice alert
3. Calls ElevenLabs TTS API (`https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`)
4. Plays audio blob via Web Audio API
5. Cooldown: minimum 60 seconds between alerts

**AI Coach Tip Flow:**

1. `usePostureSession` hook monitors `currentSlouchDuration`
2. After 30s of slouching (`TIP_TRIGGER_DURATION`), calls `fetchTip()`
3. Direct browser call to Anthropic API (`https://api.anthropic.com/v1/messages`) using `anthropic-dangerous-direct-browser-access` header
4. Model: `claude-sonnet-4-20250514`, max 60 tokens
5. Response displayed in `CoachTip` component
6. Rate limited: max 1 tip per 60 seconds

**State Management:**

- No global state store (no Redux, Zustand, Context)
- All state lives in `usePostureSession` hook via `useState` and `useRef`
- Full session history stored in `allSessionDataRef` (useRef, not useState -- avoids re-renders)
- Derived views (`liveChartData`, `recentChartData`) sliced from session ref on 1Hz timer
- Minute buckets accumulated in `minuteBucketsRef`, copied to state for rendering

## Key Abstractions

**PostureMessage:**
- Purpose: The wire protocol between server and browser
- Defined in: `web/lib/types.ts`
- Shape: `{ delta: number, timestamp: number }`
- Used by: `usePostureStream` (consumer), `web/server/main.py` (producer)

**PostureSession:**
- Purpose: Complete session state interface exposed to UI
- Defined in: `web/lib/types.ts`
- Contains: connection state, live data, chart data, stats, coaching tip, actions
- Returned by: `usePostureSession` hook
- Consumed by: `web/app/page.tsx` which destructures and passes to components

**IMUSimulator:**
- Purpose: Fake sensor data generator with realistic posture behavior
- Defined in: `web/server/main.py`
- Pattern: State machine with phases (good, transitioning_bad, bad, recovering)
- Singleton: one global instance shared across all WebSocket connections

**ChartDataPoint / MinuteBucket:**
- Purpose: Downsampled data structures for visualization
- Defined in: `web/lib/types.ts`
- `ChartDataPoint`: 1Hz samples with time label, delta, threshold line
- `MinuteBucket`: per-minute aggregation with goodPct percentage

## Entry Points

**Web Dashboard:**
- Location: `web/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Instantiates `usePostureSession` and `useVoiceAlert` hooks, composes all UI components, passes session data as props

**Simulation Server:**
- Location: `web/server/main.py`
- Triggers: `uvicorn web.server.main:app` or `python -m uvicorn main:app`
- Responsibilities: Hosts WebSocket endpoint, runs IMU simulator, accepts calibration commands

**Serial Reader:**
- Location: `serial/posture_detector.py`
- Triggers: `python posture_detector.py [--port ...] [--baud ...] [--api-port ...]`
- Responsibilities: Reads Arduino over Serial, exposes same WebSocket API as simulation server

**BLE Reader:**
- Location: `ble/reader.py`
- Triggers: `python reader.py [--api-port ...] [--no-api]`
- Responsibilities: Connects to Arduino over BLE, exposes REST API (no WebSocket)

**Servo Test Tool:**
- Location: `serial/servo_trigger.py`
- Triggers: `python servo_trigger.py [--port ...]`
- Responsibilities: Interactive CLI to send servo angle commands to Arduino

## Error Handling

**Strategy:** Fail silently at the presentation layer, retry at the connection layer.

**Patterns:**
- WebSocket: auto-reconnect with 2-second delay on disconnect (`usePostureStream`)
- Voice alerts: `catch` blocks silently swallow errors; autoplay failures are ignored
- AI tips: fallback to `DEFAULT_TIP` constant on any API error
- Serial reader: catches `SerialException`, retries connection after 3-second delay
- BLE reader: outer reconnect loop rescans for device on any connection error
- Arduino firmware: BLE variant has watchdog that resets BLE stack on 5-second data timeout

## Cross-Cutting Concerns

**Logging:**
- Server: Python `print()` statements only, no structured logging framework
- Client: no logging; errors silently caught

**Validation:**
- Server: minimal -- `json.loads` wrapped in try/except for WebSocket commands
- Client: TypeScript interfaces provide compile-time type safety; no runtime validation

**Authentication:**
- None. All endpoints are open. CORS allows all origins (`allow_origins=["*"]`).
- API keys for ElevenLabs and Anthropic are stored client-side in `NEXT_PUBLIC_*` env vars (exposed to browser)

**Real-time Communication:**
- WebSocket is the primary channel (server -> browser)
- JSON is the wire format
- No message acknowledgment or delivery guarantees
- No heartbeat/ping-pong mechanism

---

*Architecture analysis: 2026-03-28*
