"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { FriendshipDoc, FriendProfile } from "@/lib/types";

function friendshipId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

interface PendingRequest {
  id: string;
  profile: FriendProfile;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<PendingRequest[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriendships = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setPendingIncoming([]);
      setPendingOutgoing([]);
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "friendships"),
      where("users", "array-contains", user.uid)
    );
    const snap = await getDocs(q);

    const accepted: FriendProfile[] = [];
    const incoming: PendingRequest[] = [];
    const outgoing: PendingRequest[] = [];

    await Promise.all(
      snap.docs.map(async (d) => {
        const data = { id: d.id, ...d.data() } as FriendshipDoc;
        const otherUid = data.users.find((u) => u !== user.uid);
        if (!otherUid) return;

        // Resolve profile
        const profileSnap = await getDoc(doc(db, "users", otherUid));
        if (!profileSnap.exists()) return;
        const pData = profileSnap.data();
        const profile: FriendProfile = {
          uid: otherUid,
          email: pData.email ?? "",
          displayName: pData.displayName ?? "Unknown",
          photoURL: pData.photoURL ?? "",
        };

        if (data.status === "accepted") {
          accepted.push(profile);
        } else if (data.pendingFor === user.uid) {
          incoming.push({ id: d.id, profile });
        } else {
          outgoing.push({ id: d.id, profile });
        }
      })
    );

    setFriends(accepted);
    setPendingIncoming(incoming);
    setPendingOutgoing(outgoing);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  const sendRequest = useCallback(
    async (email: string): Promise<string | null> => {
      if (!user) return "Not logged in";
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) return "Enter an email";
      if (trimmed === user.email?.toLowerCase()) return "That's your own email";

      const db = getFirebaseDb();

      // Look up target user by email
      const usersQ = query(
        collection(db, "users"),
        where("email", "==", trimmed),
        limit(1)
      );
      const usersSnap = await getDocs(usersQ);
      if (usersSnap.empty) return "No user found with that email";

      const targetUid = usersSnap.docs[0].id;
      const docId = friendshipId(user.uid, targetUid);

      // Check if friendship already exists
      const existingSnap = await getDoc(doc(db, "friendships", docId));
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as FriendshipDoc;
        if (existing.status === "accepted") return "Already friends";

        // Mutual request — the other person already sent us a request
        if (existing.pendingFor === user.uid) {
          await setDoc(doc(db, "friendships", docId), {
            ...existing,
            status: "accepted",
            pendingFor: null,
            acceptedAt: Date.now(),
          });
          await fetchFriendships();
          return null; // success — auto-accepted
        }

        return "Request already sent";
      }

      // Create new pending request
      await setDoc(doc(db, "friendships", docId), {
        users: [user.uid, targetUid],
        status: "pending",
        initiatedBy: user.uid,
        pendingFor: targetUid,
        createdAt: Date.now(),
        acceptedAt: null,
      });

      await fetchFriendships();
      return null; // success
    },
    [user, fetchFriendships]
  );

  const acceptRequest = useCallback(
    async (docId: string) => {
      if (!user) return;
      const db = getFirebaseDb();
      const ref = doc(db, "friendships", docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      await setDoc(ref, {
        ...snap.data(),
        status: "accepted",
        pendingFor: null,
        acceptedAt: Date.now(),
      });

      await fetchFriendships();
    },
    [user, fetchFriendships]
  );

  const declineRequest = useCallback(
    async (docId: string) => {
      if (!user) return;
      const db = getFirebaseDb();
      await deleteDoc(doc(db, "friendships", docId));
      await fetchFriendships();
    },
    [user, fetchFriendships]
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      if (!user) return;
      const db = getFirebaseDb();
      const docId = friendshipId(user.uid, friendUid);
      await deleteDoc(doc(db, "friendships", docId));
      await fetchFriendships();
    },
    [user, fetchFriendships]
  );

  return {
    friends,
    pendingIncoming,
    pendingOutgoing,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  };
}
