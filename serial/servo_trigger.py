"""
Servo Trigger — Test script to move a servo via Serial commands.

Sends angle commands to the Arduino over Serial.
The Arduino firmware needs to be updated to accept SERVO:angle commands.

Usage:
    pip install pyserial
    python servo_trigger.py              # auto-detect port
    python servo_trigger.py --port COM3  # explicit port
"""

import argparse
import sys
import time

import serial.tools.list_ports

import serial


def find_arduino_port():
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        mfg = (p.manufacturer or "").lower()
        if any(kw in desc for kw in ["arduino", "nano 33", "nrf52"]):
            return p.device
        if "arduino" in mfg:
            return p.device
    if ports:
        print(f"Could not identify Arduino — falling back to {ports[0].device}")
        return ports[0].device
    return None


def main():
    parser = argparse.ArgumentParser(description="Servo Trigger Test")
    parser.add_argument("--port", help="Serial port (e.g. COM3, /dev/ttyACM0)")
    args = parser.parse_args()

    port = args.port or find_arduino_port()
    if not port:
        print("ERROR: No serial port found. Is the Arduino plugged in?")
        sys.exit(1)

    print(f"Connecting to {port}...")
    ser = serial.Serial(port, 115200, timeout=1)
    time.sleep(2)  # wait for Arduino reset
    print("Connected!\n")

    print("Commands:")
    print("  Type an angle (0–180) and press Enter to move the servo")
    print("  'sweep' — sweep back and forth once")
    print("  'q'     — quit\n")

    while True:
        try:
            cmd = input(">>> ").strip().lower()

            if cmd == "q":
                print("Done.")
                break

            elif cmd == "sweep":
                print("Sweeping 0 → 180 → 0...")
                ser.write(b"SERVO:0\n")
                time.sleep(1)
                ser.write(b"SERVO:180\n")
                time.sleep(1)
                ser.write(b"SERVO:0\n")
                print("Done.")

            elif cmd.isdigit():
                angle = max(0, min(180, int(cmd)))
                ser.write(f"SERVO:{angle}\n".encode())
                print(f"Moved to {angle} degrees")

            else:
                print("Enter a number 0–180, 'sweep', or 'q'")

        except KeyboardInterrupt:
            print("\nDone.")
            break

    ser.close()


if __name__ == "__main__":
    main()
