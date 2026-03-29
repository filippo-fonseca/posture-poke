"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import type { CoachDoc } from "@/lib/types";

const MAX_COACHES = 5;

export function useCoaches() {
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const [coaches, setCoaches] = useState<CoachDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoaches = useCallback(async () => {
    if (!user) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", user.uid, "coaches"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setCoaches(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoachDoc))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const createCoach = useCallback(
    async (description: string) => {
      if (!user || coaches.length >= MAX_COACHES) return;

      const res = await fetch("/api/coach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate coach");
      }

      const data = await res.json();
      const db = getFirebaseDb();
      const coachData: Omit<CoachDoc, "id"> = {
        description: description.trim(),
        audioFiles: data.audio_files,
        voiceId: data.voice_id,
        scripts: data.scripts,
        sessionId: data.session_id,
        createdAt: Date.now(),
      };

      const ref = await addDoc(
        collection(db, "users", user.uid, "coaches"),
        coachData
      );

      // Set as active coach
      update({ activeCoachId: ref.id, coachAudioFiles: data.audio_files });
      await fetchCoaches();
    },
    [user, coaches.length, update, fetchCoaches]
  );

  const deleteCoach = useCallback(
    async (coachId: string) => {
      if (!user) return;

      const db = getFirebaseDb();
      await deleteDoc(doc(db, "users", user.uid, "coaches", coachId));

      // If deleted coach was active, clear it
      if (settings.activeCoachId === coachId) {
        update({ activeCoachId: null, coachAudioFiles: [] });
      }

      await fetchCoaches();
    },
    [user, settings.activeCoachId, update, fetchCoaches]
  );

  const setActiveCoach = useCallback(
    (coachId: string) => {
      const coach = coaches.find((c) => c.id === coachId);
      if (coach) {
        update({ activeCoachId: coachId, coachAudioFiles: coach.audioFiles });
      }
    },
    [coaches, update]
  );

  return {
    coaches,
    loading,
    canCreate: coaches.length < MAX_COACHES,
    createCoach,
    deleteCoach,
    setActiveCoach,
  };
}
