export interface PostureMessage {
  delta: number;
  timestamp: number;
}

export interface CalibrationCommand {
  command: "calibrate";
}

export interface ChartDataPoint {
  time: string;
  delta: number;
  threshold: number;
}

export interface MinuteBucket {
  label: string;
  goodPct: number;
  totalReadings: number;
}

export interface PunishmentMarker {
  time: string;
  secondsIn: number;
  type: "fart" | "coach";
}

export interface CoachDoc {
  id?: string;
  description: string;
  audioFiles: string[];
  voiceId: string;
  scripts: string[];
  sessionId: string;
  createdAt: number;
}

export interface SessionDoc {
  id?: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  goodPct: number;
  alertCount: number;
  bestStreak: number;
  slouchThreshold: number;
  instructionType: "farts" | "coach";
  coachId: string | null;
  chartData: ChartDataPoint[];
  punishmentMarkers: PunishmentMarker[];
}

export type SessionState = "idle" | "running" | "paused";

export interface SessionSaveData {
  startTime: number;
  allChartData: ChartDataPoint[];
  sessionDuration: number;
  goodPct: number;
  alertCount: number;
  bestStreak: number;
}

export interface PostureSession {
  // Connection
  isConnected: boolean;

  // Session state
  sessionState: SessionState;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => SessionSaveData;

  // Live data
  currentDelta: number;
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
  currentStreakDuration: number;

  // Chart data - last 60 readings (1 per second)
  liveChartData: ChartDataPoint[];

  // Recent history - last 10 minutes continuous (1 per second)
  recentChartData: ChartDataPoint[];

  // Session stats
  sessionDuration: number;
  goodPct: number;
  alertCount: number;
  bestStreak: number;

  // History - 1-minute buckets (includes current partial minute)
  minuteBuckets: MinuteBucket[];

  // AI coach
  currentTip: string;
  isFetchingTip: boolean;
  lastTipFetchedAt: number | null;

  // Actions
  calibrate: () => void;
  fetchTip: () => void;
}
