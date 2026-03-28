"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseSerial {
  isConnected: boolean;
  /** Raw pitch from sensor (degrees) */
  rawPitch: number;
  /** Delta from calibrated baseline */
  currentDelta: number;
  /** Prompt the user to pick a serial port and start reading */
  connect: () => Promise<void>;
  /** Disconnect from the serial port */
  disconnect: () => void;
  /** Set current pitch as the 0° baseline */
  calibrate: () => void;
}

export function useSerial(): UseSerial {
  const [isConnected, setIsConnected] = useState(false);
  const [rawPitch, setRawPitch] = useState(0);
  const [baseline, setBaseline] = useState<number | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lineBufferRef = useRef("");

  const processLine = useCallback((line: string) => {
    // Arduino sends "pitch,roll\n"
    const parts = line.split(",");
    if (parts.length < 2) return;
    const pitch = parseFloat(parts[0]);
    if (isNaN(pitch)) return;
    setRawPitch(pitch);
  }, []);

  const readLoop = useCallback(async (port: SerialPort) => {
    const decoder = new TextDecoder();
    while (port.readable) {
      try {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          lineBufferRef.current += chunk;

          const lines = lineBufferRef.current.split("\n");
          // Keep the last incomplete segment in the buffer
          lineBufferRef.current = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) processLine(trimmed);
          }
        }
        reader.releaseLock();
      } catch (err) {
        // Reader was cancelled (disconnect) or port error
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("break") || msg.includes("cancel")) break;
        // Port error — wait and retry
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setIsConnected(false);
  }, [processLine]);

  const connect = useCallback(async () => {
    if (portRef.current) return;
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      abortRef.current = new AbortController();
      setIsConnected(true);
      lineBufferRef.current = "";
      readLoop(port);
    } catch {
      // User cancelled the port picker or open failed
    }
  }, [readLoop]);

  const disconnect = useCallback(async () => {
    if (readerRef.current) {
      try { await readerRef.current.cancel(); } catch {}
      readerRef.current = null;
    }
    if (portRef.current) {
      try { await portRef.current.close(); } catch {}
      portRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const calibrate = useCallback(() => {
    setBaseline(rawPitch);
  }, [rawPitch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  const currentDelta = baseline !== null ? Math.abs(rawPitch - baseline) : Math.abs(rawPitch);

  return {
    isConnected,
    rawPitch,
    currentDelta,
    connect,
    disconnect,
    calibrate,
  };
}
