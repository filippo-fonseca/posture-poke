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

export interface PostureSession {
  // Connection
  isConnected: boolean;

  // Live data
  currentDelta: number;
  isSlouchingNow: boolean;
  currentSlouchDuration: number;
  currentStreakDuration: number;

  // Chart data - last 60 readings (1 per second)
  liveChartData: ChartDataPoint[];

  // Session stats
  sessionDuration: number;
  goodPct: number;
  alertCount: number;
  bestStreak: number;

  // History - 1-minute buckets
  minuteBuckets: MinuteBucket[];

  // AI coach
  currentTip: string;
  isFetchingTip: boolean;
  lastTipFetchedAt: number | null;

  // Actions
  calibrate: () => void;
  fetchTip: () => void;
}
