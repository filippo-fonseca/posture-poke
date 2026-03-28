"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export const STRICTNESS_LEVELS = [
  { name: "Relaxed", threshold: 30, description: "30\u00B0" },
  { name: "Lenient", threshold: 25, description: "25\u00B0" },
  { name: "Moderate", threshold: 20, description: "20\u00B0" },
  { name: "Strict", threshold: 15, description: "15\u00B0" },
  { name: "Drill Sergeant", threshold: 10, description: "10\u00B0" },
];

export const HARSHNESS_LEVELS = [
  { name: "Patient", delay: 30, description: "30s" },
  { name: "Gentle", delay: 20, description: "20s" },
  { name: "Moderate", delay: 10, description: "10s" },
  { name: "Impatient", delay: 5, description: "5s" },
  { name: "Instant Karma", delay: 2, description: "2s" },
];

export type InstructionType = "farts" | "coach";

export interface Settings {
  strictness: number;
  harshness: number;
  instructionType: InstructionType;
  coachDescription: string;
  coachAudioFiles: string[];
}

const DEFAULT_SETTINGS: Settings = {
  strictness: 2,
  harshness: 2,
  instructionType: "farts",
  coachDescription: "",
  coachAudioFiles: [],
};

interface SettingsContextValue {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
  slouchThreshold: number;
  punishmentDelay: number;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  slouchThreshold: 20,
  punishmentDelay: 10,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("spinesync-settings");
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("spinesync-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const slouchThreshold = STRICTNESS_LEVELS[settings.strictness].threshold;
  const punishmentDelay = HARSHNESS_LEVELS[settings.harshness].delay;

  return (
    <SettingsContext.Provider
      value={{ settings, update, slouchThreshold, punishmentDelay }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
