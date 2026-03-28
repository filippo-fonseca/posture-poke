"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PostureMessage } from "@/lib/types";
import { WS_URL, RECONNECT_DELAY } from "@/lib/constants";

interface UsePostureStream {
  isConnected: boolean;
  currentDelta: number;
  lastTimestamp: number | null;
  sendCalibrate: () => void;
}

export function usePostureStream(): UsePostureStream {
  const [isConnected, setIsConnected] = useState(false);
  const [currentDelta, setCurrentDelta] = useState(0);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: PostureMessage = JSON.parse(event.data);
        setCurrentDelta(data.delta);
        setLastTimestamp(data.timestamp);
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      // Auto-reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const sendCalibrate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: "calibrate" }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    currentDelta,
    lastTimestamp,
    sendCalibrate,
  };
}
