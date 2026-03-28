"""
SpineSync — Real-time Posture Coaching Server
WebSocket endpoint streams IMU data at 20Hz

Architecture:
- NOW:   IMUSimulator generates realistic fake sensor data
- LATER: Swap to real Arduino serial when hardware arrives (see bottom of file)
"""

import asyncio
import json
import math
import random
import time
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SpineSync Server")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IMUSimulator:
    """
    Simulates the BMI270 accelerometer on Arduino Nano 33 BLE Sense Rev2.

    Calibration baseline: device standing straight up (90 deg from horizontal).
    Delta = deviation from that upright baseline. delta=0 means perfect posture.

    Real IMU behavior this mirrors:
    - Baseline noise: +/-1-2 deg even when sitting perfectly still (sensor noise)
    - Good posture: 0-8 deg delta, slow drift
    - Slouch transition: gradual over 3-5 seconds, not instant
    - Slouch depth: typically 20-45 deg when bad
    - Recovery: user corrects over 1-2 seconds when alerted
    - Natural variation: small oscillations from breathing (~0.5 deg amplitude, ~0.25Hz)
    - Occasional micro-movements: typing, shifting in seat
    """

    # Default baseline: 90 deg from horizontal (standing straight up)
    # Arduino pitch=0 when vertical, so baseline_pitch=0 corresponds to upright
    BASELINE_PITCH = 0.0

    def __init__(self):
        self.current_angle = 3.0
        self.target_angle = 3.0
        self.phase = "good"  # "good" | "transitioning_bad" | "bad" | "recovering"
        self.phase_timer = 0.0
        self.phase_duration = random.uniform(15, 45)  # seconds in current phase
        self.breath_phase = 0.0
        self.noise_seed = random.random() * 1000

    def tick(self, dt: float) -> float:
        """Call every 50ms, returns current angle delta in degrees."""
        self.phase_timer += dt
        self.breath_phase += dt * 2 * math.pi * 0.25  # 0.25Hz breathing

        # State machine: realistic posture patterns
        if self.phase_timer >= self.phase_duration:
            self._transition_phase()

        # Move toward target (realistic inertia)
        diff = self.target_angle - self.current_angle
        self.current_angle += diff * min(dt * 0.8, 1.0)

        # Add breathing oscillation
        breathing = math.sin(self.breath_phase) * 0.5

        # Add sensor noise (BMI270 has ~0.1 deg noise floor, amplified by mount)
        noise = (random.random() - 0.5) * 1.5

        return max(0.0, self.current_angle + breathing + noise)

    def _transition_phase(self):
        self.phase_timer = 0
        if self.phase == "good":
            # 35% chance to start slouching
            if random.random() < 0.35:
                self.phase = "transitioning_bad"
                self.target_angle = random.uniform(25, 42)
                self.phase_duration = random.uniform(3, 6)  # transition takes 3-6s
            else:
                self.target_angle = random.uniform(2, 8)
                self.phase_duration = random.uniform(10, 40)
        elif self.phase == "transitioning_bad":
            self.phase = "bad"
            self.phase_duration = random.uniform(8, 30)  # slouch for 8-30s
        elif self.phase == "bad":
            self.phase = "recovering"
            self.target_angle = random.uniform(2, 6)
            self.phase_duration = random.uniform(1, 3)  # recover in 1-3s
        elif self.phase == "recovering":
            self.phase = "good"
            self.phase_duration = random.uniform(15, 50)

    def calibrate(self):
        """Reset baseline — in simulation, just resets to good posture."""
        self.current_angle = 3.0
        self.target_angle = 3.0
        self.phase = "good"
        self.phase_timer = 0
        self.phase_duration = random.uniform(15, 45)


# Global simulator instance (shared across connections for consistency)
simulator = IMUSimulator()

# Track active WebSocket connections
active_connections: Set[WebSocket] = set()


async def stream_data(websocket: WebSocket):
    """Stream posture data at 20Hz (every 50ms)."""
    dt = 0.05  # 50ms

    while True:
        delta = simulator.tick(dt)
        timestamp = int(time.time() * 1000)  # Unix ms

        message = {
            "delta": round(delta, 2),
            "timestamp": timestamp
        }

        try:
            await websocket.send_json(message)
        except Exception:
            break

        await asyncio.sleep(dt)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)

    # Start streaming task
    stream_task = asyncio.create_task(stream_data(websocket))

    try:
        while True:
            # Listen for commands from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("command") == "calibrate":
                    simulator.calibrate()
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        stream_task.cancel()
        active_connections.discard(websocket)


@app.get("/")
async def root():
    return {
        "name": "SpineSync Server",
        "status": "running",
        "connections": len(active_connections),
        "mode": "simulation"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# =============================================================================
# TO SWAP TO REAL HARDWARE (when Arduino arrives):
# =============================================================================
#
# 1. pip install pyserial
#
# 2. Replace the simulator loop in stream_data() with:
#
# import serial
#
# # Default baseline: 90 deg from horizontal (standing straight up).
# # Arduino pitch=0 when vertical, so baseline_pitch=0 = upright.
# baseline_pitch = 0.0
#
# async def stream_data_real(websocket: WebSocket):
#     """Stream real IMU data from Arduino over serial."""
#     ser = serial.Serial('/dev/tty.usbmodem1101', 115200)  # adjust port
#
#     while True:
#         try:
#             if ser.in_waiting:
#                 line = ser.readline().decode().strip()
#                 parts = line.split(',')
#                 pitch = float(parts[0])
#                 # roll = float(parts[1])  # available if needed
#                 delta = abs(pitch - baseline_pitch)
#                 timestamp = int(time.time() * 1000)
#
#                 message = {
#                     "delta": round(delta, 2),
#                     "timestamp": timestamp
#                 }
#
#                 await websocket.send_json(message)
#             await asyncio.sleep(0.01)  # Small sleep to prevent CPU spinning
#         except Exception as e:
#             print(f"Serial error: {e}")
#             break
#
# Arduino firmware sends "pitch,roll\n" over Serial.
# Default baseline_pitch=0 assumes device calibrated standing straight up
# (90 deg from horizontal). Calibrate command resamples baseline_pitch.
# WebSocket message format stays identical — browser never changes.
# =============================================================================
