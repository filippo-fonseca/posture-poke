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
  /** Send a raw command string to the Arduino (e.g. "SERVO:90") */
  sendCommand: (cmd: string) => void;
}

export function useSerial(): UseSerial {
  const [isConnected, setIsConnected] = useState(false);
  const [rawPitch, setRawPitch] = useState(0);
  const [baseline, setBaseline] = useState<number | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const lineBufferRef = useRef("");
  const mountedRef = useRef(true);
  const lastPitchRef = useRef(0);

  const processLine = useCallback((line: string) => {
    if (!mountedRef.current) return;
    const parts = line.split(",");
    if (parts.length < 2) return;
    const pitch = parseFloat(parts[0]);
    if (isNaN(pitch)) return;
    if (Math.abs(pitch - lastPitchRef.current) < 0.3) return;
    lastPitchRef.current = pitch;
    setRawPitch(pitch);
  }, []);

  const readLoop = useCallback(async (port: SerialPort) => {
    const decoder = new TextDecoder();
    while (port.readable && mountedRef.current) {
      try {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        while (true) {
          const { value, done } = await reader.read();
          if (done || !mountedRef.current) break;
          const chunk = decoder.decode(value, { stream: true });
          lineBufferRef.current += chunk;

          const lines = lineBufferRef.current.split("\n");
          lineBufferRef.current = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) processLine(trimmed);
          }
        }
        reader.releaseLock();
      } catch {
        break;
      }
    }
    if (mountedRef.current) setIsConnected(false);
  }, [processLine]);

  const sendCommand = useCallback((cmd: string) => {
    if (!writerRef.current) return;
    const encoder = new TextEncoder();
    writerRef.current.write(encoder.encode(cmd + "\n")).catch(() => {});
  }, []);

  const disconnect = useCallback(async () => {
    if (readerRef.current) {
      try { await readerRef.current.cancel(); } catch {}
      readerRef.current = null;
    }
    if (writerRef.current) {
      try { writerRef.current.releaseLock(); } catch {}
      writerRef.current = null;
    }
    if (portRef.current) {
      try { await portRef.current.close(); } catch {}
      portRef.current = null;
    }
    if (mountedRef.current) setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    if (portRef.current) return;
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;

      // Grab writer for sending commands
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      if (mountedRef.current) setIsConnected(true);
      lineBufferRef.current = "";
      readLoop(port);
    } catch {
      // User cancelled the port picker or open failed
    }
  }, [readLoop]);

  const calibrate = useCallback(() => {
    setBaseline(rawPitch);
  }, [rawPitch]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
      if (writerRef.current) {
        try { writerRef.current.releaseLock(); } catch {}
        writerRef.current = null;
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
        portRef.current = null;
      }
    };
  }, []);

  const currentDelta = baseline !== null ? Math.abs(rawPitch - baseline) : Math.abs(rawPitch);

  return {
    isConnected,
    rawPitch,
    currentDelta,
    connect,
    disconnect,
    calibrate,
    sendCommand,
  };
}
