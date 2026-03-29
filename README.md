# PosturePoke

**Watch your back.**

---

## Your Spine Is Failing You (And You're Letting It)

80% of Americans will experience back pain. College students sit 8-10 hours a day hunched over laptops, training their bodies into question marks. The average age chronic back issues start? 21.

Traditional posture solutions are boring. So people ignore them.

We took a different approach: **make the consequences of bad posture so ridiculous that you _have_ to sit up straight.**

## The Escalation Ladder

PosturePoke monitors your spine angle in real-time using an IMU sensor clipped to your shirt. When you slouch, things happen. You pick how bad:

| Level | Punishment | Description |
|-------|-----------|-------------|
| Mild | **Beep** | A simple tone. Polite. For now. |
| Medium | **Fart Sounds** | Your laptop rips one in the quiet library. |
| Spicy | **AI Coach** | Design your own unhinged voice coach. Sassy grandma? Drill sergeant? British butler? It roasts you. In their voice. |
| Nuclear | **The Poker** | A servo-powered needle gives you a gentle poke. Real hardware. Real motivation. Real consequences. |

Mix and match. Stack them. Or pick "I'm scared" mode and pretend you have a good excuse.

## How It Works

```
PosturePoke Device ──USB Serial──> Browser (Web Serial API) ──> Next.js App
        │                                                              │
    IMU sensor                                                   Punishments
   reads pitch/roll                                          (audio + servo poke)
   at 10 Hz                                                         │
        │                                                    Gemini + ElevenLabs
        └── The Poker (servo) <── SERVO:90/SERVO:0 ──────── (AI coach generation)
```

1. **Clip it on** — attach the PosturePoke device to your collar
2. **Connect** — the browser talks directly to the device via Web Serial API (no server needed)
3. **Calibrate** — sit up straight, press calibrate, that's your 0 degrees
4. **Get wrecked** — slouch too long and your chosen punishment kicks in

## The Social Layer

- **Friends** — add friends by email, see their latest sessions, compete on posture scores
- **Coach sharing** — your friends' AI coaches show up in your session config. More friends = more coaches.
- **Session history** — full charts with punishment markers, average deviation, color-coded by strictness
- **Share** — post your results to X, LinkedIn (with _thrilled to announce_ energy), Facebook, or WhatsApp

## Quick Start

### Important: Hardware Required

PosturePoke requires the PosturePoke device to function. The app uses the Web Serial API to communicate directly with the device over USB — there is no simulation mode. Without the device connected, you can browse past sessions and manage coaches, but you cannot start a posture monitoring session.

### Hardware

Flash `serial/posture_poke.ino` to the PosturePoke device. The Poker (servo) is built into the device.

### Web App

```bash
npm install
cp .env.example .env.local   # fill in API keys
npm run dev
```

Open `http://localhost:3000` in Chrome (Web Serial requires Chrome/Edge). Connect the sensor via the port picker.

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Auth + Firestore | Yes |
| `GEMINI_API_KEY` | AI coach script generation | For coach feature |
| `ELEVENLABS_API_KEY` | Voice design + text-to-speech | For coach feature |

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Recharts, Framer Motion
- **Hardware**: PosturePoke device (IMU sensor + servo poker)
- **Browser APIs**: Web Serial API (direct USB serial, no backend needed)
- **AI**: Gemini 2.5 Flash (script generation), ElevenLabs (voice design + TTS)
- **Backend**: Firebase Auth (Google OAuth), Firestore (sessions, coaches, friends)
- **No Python server** — the browser reads from the Arduino directly

## Project Structure

```
/
├── app/                  # Next.js pages + API routes
│   ├── page.tsx          # Dashboard (main app)
│   ├── welcome/          # Landing page
│   ├── login/            # Auth page
│   └── api/coach/        # Gemini + ElevenLabs endpoints
├── components/           # React components
├── hooks/                # Custom hooks (useSerial, usePostureSession, useFriends, etc.)
├── lib/                  # Settings, auth, Firebase, types
├── public/audio/         # Generated coach audio + fart sounds + beep
├── serial/
│   └── posture_poke.ino  # Combined IMU + servo firmware
└── firestore.rules       # Security rules
```

## Built With (Hackathon Details)

- **IDE**: [Zed](https://zed.dev)
- **APIs used**:
  - [Gemini 2.5 Flash](https://ai.google.dev/) — generates 10 funny, in-character posture correction scripts from a user's coach description
  - [ElevenLabs](https://elevenlabs.io/) — designs a custom voice from a text description and generates text-to-speech audio for each script
- **Auth & Database**: Firebase (Google OAuth + Firestore)
- **No backend server** — the Next.js app talks to the hardware directly via the Web Serial API and uses Next.js API routes for AI coach generation

---

Built for YHack 2026 Hardware Track.
