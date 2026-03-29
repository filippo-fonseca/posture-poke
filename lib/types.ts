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
  type: "beep" | "fart" | "coach";
  poked?: boolean;
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
  avgDeviation: number;
  alertCount: number;
  bestStreak: number;
  slouchThreshold: number;
  strictness?: number;
  harshness?: number;
  instructionType: "farts" | "coach";
  coachId: string | null;
  chartData: ChartDataPoint[];
  punishmentMarkers: PunishmentMarker[];
}

export interface FriendshipDoc {
  id?: string;
  users: string[];
  status: "pending" | "accepted";
  initiatedBy: string;
  pendingFor: string | null;
  createdAt: number;
  acceptedAt: number | null;
}

export interface FriendProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export type SessionState = "idle" | "running" | "paused";

export interface SessionSaveData {
  startTime: number;
  allChartData: ChartDataPoint[];
  sessionDuration: number;
  goodPct: number;
  avgDeviation: number;
  alertCount: number;
  bestStreak: number;
}

export interface PostureSession {
  // Serial connection
  isConnected: boolean;
  connectSerial: () => Promise<void>;
  disconnectSerial: () => void;

  // Session state
  sessionState: SessionState;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => SessionSaveData;

  // Live data
  currentDelta: number;
  rawPitch: number;
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
  sendCommand: (cmd: string) => void;
  fetchTip: () => void;
}
