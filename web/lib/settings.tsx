"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { useAuth } from "./auth";
import type { CoachDoc } from "./types";

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
  activeCoachId: string | null;
  activeCoachOwnerUid: string | null;
  coachAudioFiles: string[];
}

const DEFAULT_SETTINGS: Settings = {
  strictness: 2,
  harshness: 2,
  instructionType: "farts",
  activeCoachId: null,
  activeCoachOwnerUid: null,
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
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [firestoreReady, setFirestoreReady] = useState(false);

  // Load settings: Firestore if logged in, localStorage fallback
  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem("spinesync-settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
            ...DEFAULT_SETTINGS,
            strictness: parsed.strictness ?? DEFAULT_SETTINGS.strictness,
            harshness: parsed.harshness ?? DEFAULT_SETTINGS.harshness,
            instructionType: parsed.instructionType ?? DEFAULT_SETTINGS.instructionType,
            activeCoachId: parsed.activeCoachId ?? null,
            activeCoachOwnerUid: parsed.activeCoachOwnerUid ?? null,
            coachAudioFiles: parsed.coachAudioFiles ?? [],
          });
        }
      } catch {}
      setFirestoreReady(false);
      return;
    }

    const db = getFirebaseDb();
    const userRef = doc(db, "users", user.uid);

    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const ownerUid = data.activeCoachOwnerUid ?? null;
        setSettings({
          strictness: data.strictness ?? DEFAULT_SETTINGS.strictness,
          harshness: data.harshness ?? DEFAULT_SETTINGS.harshness,
          instructionType: data.instructionType ?? DEFAULT_SETTINGS.instructionType,
          activeCoachId: data.activeCoachId ?? null,
          activeCoachOwnerUid: ownerUid,
          coachAudioFiles: [],
        });

        // Resolve active coach audio files
        if (data.activeCoachId) {
          const coachRef = doc(db, "users", ownerUid || user.uid, "coaches", data.activeCoachId);
          getDoc(coachRef).then((coachSnap) => {
            if (coachSnap.exists()) {
              const coach = coachSnap.data() as CoachDoc;
              setSettings((prev) => ({ ...prev, coachAudioFiles: coach.audioFiles }));
            }
          });
        }
      } else {
        // First login — create user doc
        setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Date.now(),
          strictness: DEFAULT_SETTINGS.strictness,
          harshness: DEFAULT_SETTINGS.harshness,
          instructionType: DEFAULT_SETTINGS.instructionType,
          activeCoachId: null,
        });
      }
      setFirestoreReady(true);
    });
  }, [user]);

  const update = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };

        if (user && firestoreReady) {
          const db = getFirebaseDb();
          const userRef = doc(db, "users", user.uid);
          const firestoreFields: Record<string, unknown> = {};
          if ("strictness" in partial) firestoreFields.strictness = partial.strictness;
          if ("harshness" in partial) firestoreFields.harshness = partial.harshness;
          if ("instructionType" in partial) firestoreFields.instructionType = partial.instructionType;
          if ("activeCoachId" in partial) firestoreFields.activeCoachId = partial.activeCoachId;
          if ("activeCoachOwnerUid" in partial) firestoreFields.activeCoachOwnerUid = partial.activeCoachOwnerUid;

          if (Object.keys(firestoreFields).length > 0) {
            updateDoc(userRef, firestoreFields);
          }

          // If activeCoachId changed, resolve audio files
          if ("activeCoachId" in partial && partial.activeCoachId) {
            const coachOwner = partial.activeCoachOwnerUid ?? next.activeCoachOwnerUid ?? user.uid;
            const coachRef = doc(db, "users", coachOwner, "coaches", partial.activeCoachId);
            getDoc(coachRef).then((snap) => {
              if (snap.exists()) {
                const coach = snap.data() as CoachDoc;
                setSettings((s) => ({ ...s, coachAudioFiles: coach.audioFiles }));
              }
            });
          } else if ("activeCoachId" in partial && !partial.activeCoachId) {
            next.coachAudioFiles = [];
          }
        } else {
          localStorage.setItem("spinesync-settings", JSON.stringify(next));
        }

        return next;
      });
    },
    [user, firestoreReady]
  );

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
