"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { CoachDoc, SessionDoc, FriendProfile } from "@/lib/types";

export function useFriendCoaches(friendUid: string | null) {
  const [coaches, setCoaches] = useState<CoachDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendUid) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", friendUid, "coaches"),
      orderBy("createdAt", "desc")
    );
    getDocs(q).then((snap) => {
      setCoaches(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoachDoc))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [friendUid]);

  return { coaches, loading };
}

export interface FriendLatestSession {
  friend: FriendProfile;
  session: SessionDoc;
}

export function useFriendsLatestSessions(friends: FriendProfile[]) {
  const [data, setData] = useState<FriendLatestSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (friends.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();
    Promise.all(
      friends.map(async (friend) => {
        try {
          const q = query(
            collection(db, "users", friend.uid, "sessions"),
            orderBy("endedAt", "desc"),
            limit(1)
          );
          const snap = await getDocs(q);
          if (snap.empty) return null;
          const doc = snap.docs[0];
          const sData = doc.data();
          const session: SessionDoc = {
            id: doc.id,
            ...sData,
            startedAt: sData.startedAt?.toMillis?.() ?? sData.startedAt,
            endedAt: sData.endedAt?.toMillis?.() ?? sData.endedAt,
          } as SessionDoc;
          return { friend, session };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      setData(results.filter((r): r is FriendLatestSession => r !== null));
      setLoading(false);
    });
  }, [friends]);

  return { data, loading };
}

export function useFriendSessions(friendUid: string | null) {
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendUid) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", friendUid, "sessions"),
      orderBy("endedAt", "desc")
    );
    getDocs(q).then((snap) => {
      setSessions(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            startedAt: data.startedAt?.toMillis?.() ?? data.startedAt,
            endedAt: data.endedAt?.toMillis?.() ?? data.endedAt,
          } as SessionDoc;
        })
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [friendUid]);

  return { sessions, loading };
}
