"""
Posture Detector — Wireless BLE Tilt Reader

Connects to the Arduino Nano 33 BLE Sense Rev2 over Bluetooth,
receives live pitch/roll data, prints it to the terminal, and
exposes a FastAPI endpoint for other apps to consume.

Usage:
    pip install bleak fastapi uvicorn
    python posture_reader.py

API endpoint (while running):
    GET http://localhost:8000/tilt  →  { "pitch": ..., "roll": ..., ... }

No cables needed after flashing the firmware once.
"""

import argparse
import asyncio
import struct
import sys
import threading
import time
from datetime import datetime

import uvicorn
from bleak import BleakClient, BleakScanner
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── BLE UUIDs (must match the Arduino firmware) ──────────────
SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214"
TILT_CHAR_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214"

DEVICE_NAME = "PostureDetector"

# ── Shared state ──────────────────────────────────────────────
latest_reading = {
    "pitch": 0.0,
    "roll": 0.0,
    "posture": "unknown",
    "timestamp": None,
}

# ── Configuration ─────────────────────────────────────────────
PITCH_THRESHOLD = 25.0  # degrees forward/back before "BAD"
ROLL_THRESHOLD = 20.0  # degrees left/right before "BAD"


# ── BLE notification handler ─────────────────────────────────
def on_tilt_notify(sender, data: bytearray):
    """Called every time the Arduino sends a new tilt reading."""
    global latest_reading

    if len(data) < 8:
        return

    pitch, roll = struct.unpack("<ff", data[:8])

    if abs(pitch) > PITCH_THRESHOLD or abs(roll) > ROLL_THRESHOLD:
        posture = "BAD"
    else:
        posture = "GOOD"

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


# ── BLE connection loop ──────────────────────────────────────
async def ble_loop():
    print(f"Scanning for '{DEVICE_NAME}'...")

    while True:  # outer reconnect loop
        device = None
        while device is None:
            devices = await BleakScanner.discover(
                timeout=5.0,
                service_uuids=[SERVICE_UUID],  # ← filter by service, not just name
            )
            for d in devices:
                if d.name and DEVICE_NAME.lower() in d.name.lower():
                    device = d
                    break
            if device is None:
                print("  Not found yet — retrying...")

        print(f"Found {device.name} ({device.address}). Connecting...")

        try:
            async with BleakClient(
                device
            ) as client:  # ← pass device OBJECT, not .address
                print("Connected! Receiving tilt data wirelessly...\n")
                await client.start_notify(TILT_CHAR_UUID, on_tilt_notify)

                while client.is_connected:
                    await asyncio.sleep(1)

        except Exception as e:
            print(f"\nConnection lost: {e}")

        print("Disconnected. Rescanning...")


def run_ble_in_thread():
    """Run the async BLE loop in a background thread."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(ble_loop())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"\nBLE error: {e}")
        print("Make sure Bluetooth is enabled on your computer.")


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
    """Return the latest tilt reading."""
    return latest_reading


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Main ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Posture Detector — Wireless BLE Reader"
    )
    parser.add_argument(
        "--api-port",
        type=int,
        default=8000,
        help="Port for the REST API (default 8000)",
    )
    parser.add_argument(
        "--no-api",
        action="store_true",
        help="Disable the API server, just print to terminal",
    )
    args = parser.parse_args()

    # Start BLE reader in background thread
    ble_thread = threading.Thread(target=run_ble_in_thread, daemon=True)
    ble_thread.start()

    if args.no_api:
        print("(API disabled — terminal output only)\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        print(f"Starting API server on http://localhost:{args.api_port}")
        print(f"  GET /tilt   — latest reading")
        print(f"  GET /health — health check\n")
        uvicorn.run(app, host="0.0.0.0", port=args.api_port, log_level="warning")


if __name__ == "__main__":
    main()
