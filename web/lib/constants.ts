export const SLOUCH_THRESHOLD = 20; // degrees
export const ALERT_COOLDOWN = 60; // seconds between voice alerts
export const TIP_TRIGGER_DURATION = 30; // seconds of slouching before fetching tip

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
export const RECONNECT_DELAY = 2000; // ms

export const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export const VOICE_MESSAGES = {
  10: "Heads up — you're starting to slouch. Roll those shoulders back.",
  30: "You've been slouching for 30 seconds. Time to sit up straight.",
  60: "Still slouching. Take a breath, reset your posture.",
} as const;

export const DEFAULT_TIP = "Keep your shoulders back and chin tucked. Your spine will thank you.";

export const CHART_HISTORY_SECONDS = 60;
export const RECENT_HISTORY_SECONDS = 600; // 10 minutes at 1Hz
export const STREAM_FREQUENCY_HZ = 20;
