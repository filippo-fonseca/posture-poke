"""
Posture Detector — USB Serial Reader

Reads pitch/roll over USB serial and exposes a FastAPI endpoint.

Usage:
    pip install pyserial fastapi uvicorn
    python posture_reader.py
"""

import argparse
import threading
import time
from datetime import datetime

import serial
import serial.tools.list_ports
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Shared state ──────────────────────────────────────────────
latest_reading = {
    "pitch": 0.0,
    "roll": 0.0,
    "posture": "unknown",
    "timestamp": None,
}

PITCH_THRESHOLD = 25.0
ROLL_THRESHOLD = 20.0


def find_arduino():
    """Auto-detect the Arduino serial port."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        # Arduino Nano 33 BLE shows up with these identifiers
        if "Arduino" in (p.manufacturer or "") or "2341" in (
            p.vid and hex(p.vid) or ""
        ):
            return p.device
        # fallback: common USB-serial chip identifiers
        if any(
            name in (p.description or "") for name in ["Nano 33", "nRF52", "USB Serial"]
        ):
            return p.device
    return None


def serial_loop(port, baud):
    """Read serial data from the Arduino."""
    global latest_reading

    while True:
        try:
            print(f"Connecting to {port} at {baud} baud...")
            with serial.Serial(port, baud, timeout=2) as ser:
                print("Connected! Receiving tilt data...\n")
                time.sleep(2)  # wait for Arduino to reset after serial connect

                while True:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not line:
                        continue

                    try:
                        pitch, roll = [float(x) for x in line.split(",")]
                    except ValueError:
                        continue  # skip malformed lines

                    posture = (
                        "BAD"
                        if abs(pitch) > PITCH_THRESHOLD or abs(roll) > ROLL_THRESHOLD
                        else "GOOD"
                    )

                    latest_reading = {
                        "pitch": round(pitch, 2),
                        "roll": round(roll, 2),
                        "posture": posture,
                        "timestamp": datetime.now().isoformat(),
                    }

                    indicator = "\u2705" if posture == "GOOD" else "\u26a0\ufe0f"
                    print(
                        f"\r{indicator}  Pitch: {pitch:+6.1f}\u00b0  |  Roll: {roll:+6.1f}\u00b0  |  Posture: {posture}   ",
                        end="",
                        flush=True,
                    )

        except serial.SerialException as e:
            print(f"\nSerial error: {e}")
            print("Retrying in 3 seconds...")
            time.sleep(3)


# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(title="Posture Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/tilt")
def get_tilt():
    return latest_reading


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Main ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Posture Detector — Serial Reader")
    parser.add_argument(
        "--port", type=str, default=None, help="Serial port (auto-detected if omitted)"
    )
    parser.add_argument(
        "--baud", type=int, default=115200, help="Baud rate (default 115200)"
    )
    parser.add_argument(
        "--api-port", type=int, default=8000, help="API port (default 8000)"
    )
    parser.add_argument("--no-api", action="store_true", help="Disable API server")
    args = parser.parse_args()

    port = args.port or find_arduino()
    if not port:
        print("Could not find Arduino. Available ports:")
        for p in serial.tools.list_ports.comports():
            print(f"  {p.device}  —  {p.description} ({p.manufacturer})")
        print("\nSpecify manually with --port /dev/tty.usbmodemXXXX")
        return

    ser_thread = threading.Thread(
        target=serial_loop, args=(port, args.baud), daemon=True
    )
    ser_thread.start()

    if args.no_api:
        print("(API disabled — terminal output only)\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        print(f"Starting API server on http://localhost:{args.api_port}\n")
        uvicorn.run(app, host="0.0.0.0", port=args.api_port, log_level="warning")


if __name__ == "__main__":
    main()
