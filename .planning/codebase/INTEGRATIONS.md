# External Integrations

**Analysis Date:** 2026-03-28

## Overview

SpineSync integrates with two external AI APIs (Anthropic Claude and ElevenLabs TTS), communicates with Arduino hardware via USB Serial or Bluetooth Low Energy, and uses WebSockets for real-time browser-to-server communication. All external API calls are made directly from the browser (client-side) -- there is no server-side proxy.

## APIs & External Services

**Anthropic Claude API (AI Coaching Tips):**
- Purpose: Generates short, actionable posture correction tips when the user is slouching
- SDK/Client: Direct `fetch()` to REST API from browser (`web/hooks/usePostureSession.ts` lines 186-226)
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-20250514`
- Auth: `NEXT_PUBLIC_ANTHROPIC_API_KEY` env var, sent as `x-api-key` header
- Special header: `anthropic-dangerous-direct-browser-access: true` (bypasses CORS restriction for direct browser calls)
- Trigger: Auto-fetches when slouching exceeds 30 seconds (`TIP_TRIGGER_DURATION` in `web/lib/constants.ts`), with 60-second cooldown between fetches
- Fallback: If no API key is set, displays static default tip from `web/lib/constants.ts`
- Max tokens: 60

**ElevenLabs Text-to-Speech API (Voice Alerts):**
- Purpose: Speaks posture correction reminders aloud at escalating intervals
- SDK/Client: Direct `fetch()` to REST API from browser (`web/hooks/useVoiceAlert.ts` lines 53-96)
- Endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Voice ID: `21m00Tcm4TlvDq8ikWAM` (Rachel voice, hardcoded in `web/lib/constants.ts`)
- Model: `eleven_monolingual_v1`
- Auth: `NEXT_PUBLIC_ELEVENLABS_API_KEY` env var, sent as `xi-api-key` header
- Trigger schedule (defined in `web/lib/constants.ts`):
  - 10s slouching: "Heads up -- you're starting to slouch. Roll those shoulders back."
  - 30s slouching: "You've been slouching for 30 seconds. Time to sit up straight."
  - 60s slouching: "Still slouching. Take a breath, reset your posture."
- Cooldown: 60 seconds between alerts (`ALERT_COOLDOWN` in `web/lib/constants.ts`)
- Audio playback: Uses browser `AudioContext` + `Audio` element
- Fallback: If no API key, voice alerts are silently disabled

## Real-time Communication

**WebSocket (Browser <-> Python Server):**
- Purpose: Streams posture angle data from server to browser at 20Hz (simulation) or 10Hz (real hardware)
- Protocol: WebSocket (`ws://`)
- Default URL: `ws://localhost:8000/ws` (configurable via `NEXT_PUBLIC_WS_URL`)
- Client implementation: `web/hooks/usePostureStream.ts`
- Server implementation: `web/server/main.py` (simulation), `serial/posture_detector.py` (real hardware)

**Message format (server -> client):**
```json
{
  "delta": 23.4,
  "timestamp": 1234567890
}
```
- `delta`: Angle deviation from calibrated baseline in degrees (0 = perfect posture)
- `timestamp`: Unix timestamp in milliseconds

**Commands (client -> server):**
```json
{
  "command": "calibrate"
}
```
- Resets the baseline angle to the current position

**Connection management:**
- Auto-reconnect on disconnect with 2000ms delay (`RECONNECT_DELAY` in `web/lib/constants.ts`)
- Connection state tracked in `usePostureStream` hook
- Server tracks active connections in a `Set[WebSocket]`
- CORS: Allow all origins (`*`) on both simulation and hardware servers

## Hardware Integrations

**Arduino Nano 33 BLE Sense Rev2:**
- Sensor: BMI270 IMU (accelerometer) via `Arduino_BMI270_BMM150.h` library
- Calculates pitch and roll from accelerometer readings using `atan2`

**Connection Mode 1 -- USB Serial (`serial/`):**
- Firmware: `serial/serial.ino`
- Python reader: `serial/posture_detector.py`
- Library: `pyserial` (`import serial`)
- Baud rate: 115200
- Data format: `pitch,roll\n` (two comma-separated floats over USB Serial)
- Update rate: 10 Hz (100ms interval from Arduino)
- Auto-detection: `find_arduino()` in `serial/posture_detector.py` scans for Arduino VID `0x2341` or known device names
- Reconnection: Automatic retry on `SerialException` with 3-second delay
- REST endpoint: `GET /tilt` returns latest reading as JSON
- WebSocket endpoint: `/ws` streams delta values at 10Hz

**Connection Mode 2 -- Bluetooth Low Energy (`ble/`):**
- Firmware: `ble/uno.ino`
- Python reader: `ble/reader.py`
- Library: `bleak` (BleakClient, BleakScanner)
- BLE Service UUID: `19B10000-E8F2-537E-4F6C-D104768A1214`
- Tilt Characteristic UUID: `19B10001-E8F2-537E-4F6C-D104768A1214` (Read + Notify)
- Data format: 8-byte binary packet `[float32 pitch, float32 roll]` (little-endian)
- Device name: `PostureDetector`
- Update rate: 10 Hz
- Auto-reconnect: Scanner loops indefinitely until device found, reconnects on disconnect
- Watchdog: Arduino-side 5-second timeout forces BLE stack reset if no data sent
- REST endpoint: `GET /tilt` returns latest reading as JSON
- Utility: `ble/see_devices.py` -- standalone BLE scanner for debugging

**Connection Mode 3 -- Simulation (default, `web/server/`):**
- No hardware required
- `IMUSimulator` class in `web/server/main.py` generates realistic fake sensor data
- Simulates: baseline noise (1-2 deg), breathing oscillation (0.5 deg at 0.25Hz), slouch transitions (3-6s), slouch depth (25-42 deg), recovery (1-3s)
- State machine with phases: `good` -> `transitioning_bad` -> `bad` -> `recovering` -> `good`
- Update rate: 20 Hz (50ms interval)

**Servo Control (experimental):**
- `serial/servo_trigger.py` -- Interactive test script for controlling a servo motor via serial
- Sends `SERVO:angle\n` commands to Arduino
- Not connected to the main posture detection pipeline
- Requires Arduino firmware modification to accept servo commands

## Data Storage

**Databases:**
- None. All data is in-memory only. No persistence layer.

**File Storage:**
- `sounds/` directory contains 11 MP3 files (fart sound effects) -- static assets, not yet integrated
- No file upload/download functionality

**Caching:**
- None. No caching layer.

## Authentication & Identity

**Auth Provider:**
- None. No user authentication or identity management.
- API keys are stored in browser-accessible environment variables (`NEXT_PUBLIC_*`)

## Monitoring & Observability

**Error Tracking:**
- None. No error tracking service.

**Logs:**
- Python server: `print()` statements for serial/BLE connection status
- Uvicorn: `log_level="warning"` in production
- Frontend: Silent error handling (catch blocks swallow errors)

## CI/CD & Deployment

**Hosting:**
- Frontend targets Vercel (`.vercel` in `web/.gitignore`)
- Backend is local-only (must run on machine connected to Arduino)

**CI Pipeline:**
- None. No CI/CD configuration detected.

## Environment Configuration

**Required env vars (for full functionality):**
- `NEXT_PUBLIC_WS_URL` - WebSocket server URL (has default: `ws://localhost:8000/ws`)
- `NEXT_PUBLIC_ELEVENLABS_API_KEY` - ElevenLabs API key (optional, enables voice alerts)
- `NEXT_PUBLIC_ANTHROPIC_API_KEY` - Anthropic API key (optional, enables AI coaching tips)

**Env file locations:**
- Template: `web/.env.example`
- Runtime: `web/.env.local` (gitignored)

**Secrets handling:**
- All API keys are exposed to the browser via `NEXT_PUBLIC_*` prefix
- No server-side proxy for API calls
- No secrets management system

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Integration Dependency Map

```
Browser (Next.js)
  |
  |-- WebSocket --> Python FastAPI Server (localhost:8000)
  |                   |
  |                   |-- USB Serial --> Arduino Nano 33 BLE  (serial/ mode)
  |                   |-- IMU Simulator                       (simulation mode)
  |
  |-- HTTPS --> api.anthropic.com       (AI coaching tips)
  |-- HTTPS --> api.elevenlabs.io       (voice alerts)
  |
  |                  OR
  |
  Python BLE Reader (ble/ mode)
    |-- Bluetooth --> Arduino Nano 33 BLE
    |-- REST /tilt endpoint (no WebSocket to browser yet)
```

**Note:** The BLE reader (`ble/reader.py`) exposes only a REST `GET /tilt` endpoint, not a WebSocket endpoint. It is not yet compatible with the web frontend, which requires WebSocket at `/ws`. The serial reader (`serial/posture_detector.py`) has both REST and WebSocket endpoints and is fully compatible.

---

*Integration audit: 2026-03-28*
