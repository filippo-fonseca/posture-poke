# SpineSync — we got your back. literally.

Real-time posture coaching powered by IMU sensors and AI.

## Quick Start

### 1. Start the data server

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Start the web app

```bash
npm install
npm run dev
```

### 3. Open http://localhost:3000

The app runs in simulation mode by default — realistic fake IMU data.

## Connecting Real Hardware (when Arduino arrives)

1. Flash the Arduino firmware (see /firmware/posture_coach.ino)
2. Plug Arduino into laptop via USB
3. In server/main.py, replace the simulator with the serial reader:
   Uncomment the serial section, update the port, restart uvicorn.
4. Everything else stays the same.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in API keys.
ElevenLabs and Claude keys are optional — app works without them,
just without voice alerts and AI tips.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│         Next.js App (React + TypeScript)         │
│         Connects via WebSocket to localhost:8000 │
└─────────────────────┬───────────────────────────┘
                      │ WebSocket ws://localhost:8000/ws
                      │ JSON: { delta: 23.4, timestamp: 1234567890 }
┌─────────────────────▼───────────────────────────┐
│           Python FastAPI Server (local)          │
│                                                  │
│   NOW:  simulate_imu() — realistic fake data     │
│   LATER: read_arduino() — real serial port       │
└──────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Recharts, Framer Motion
- **Backend**: Python FastAPI, WebSockets
- **AI**: Claude (coaching tips), ElevenLabs (voice alerts)
- **Hardware**: Arduino Nano 33 BLE Sense Rev2 (BMI270 IMU)

---

Built for YHack 2026 Hardware Track
