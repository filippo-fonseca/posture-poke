# Future Arduino Integration Swap

When the Arduino Nano 33 BLE Sense Rev2 arrives, follow these steps to swap from simulation to real sensor data. The Next.js app never changes — only the firmware and one section of the Python server.

---

## Step 1 — Flash this firmware to the Arduino

Open Arduino IDE, paste this, upload:

```cpp
/*
  SpineSync Firmware
  Arduino Nano 33 BLE Sense Rev2
  
  Reads BMI270 IMU, calculates spine angle delta from baseline,
  prints one float per line over Serial at 20Hz.
  
  Library needed: Arduino_BMI270_BMM150
  (Install via Library Manager)
*/

#include "Arduino_BMI270_BMM150.h"

float baseline_pitch = 0.0;
unsigned long last_sample = 0;
const int SAMPLE_MS = 50; // 20Hz

float getPitch() {
  float ax, ay, az;
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);
    return atan2(ay, az) * 180.0 / PI;
  }
  return baseline_pitch;
}

void calibrate() {
  float sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += getPitch();
    delay(50);
  }
  baseline_pitch = sum / 20.0;
}

void setup() {
  Serial.begin(115200);
  if (!IMU.begin()) {
    while (1); // halt if IMU fails
  }
  delay(2000);  // sit still and straight for 2 seconds on boot
  calibrate();
}

void loop() {
  if (millis() - last_sample < SAMPLE_MS) return;
  last_sample = millis();

  float pitch = getPitch();
  float delta = abs(pitch - baseline_pitch);
  Serial.println(delta); // prints e.g. "23.4"
}
```

After uploading, open Serial Monitor (115200 baud) and confirm you see numbers printing — that means it's working.

---

## Step 2 — Find your serial port

**Mac:**
```bash
ls /dev/tty.usbmodem*
# will show something like /dev/tty.usbmodem1101
```

**Windows:**
```
Device Manager → Ports (COM & LPT) → look for Arduino
# will show something like COM3 or COM7
```

**Linux:**
```bash
ls /dev/ttyACM*
# will show something like /dev/ttyACM0
```

---

## Step 3 — Swap one section in `server/main.py`

Find this block in your server file:

```python
# SIMULATION MODE (current)
simulator = IMUSimulator()
async def get_next_delta() -> float:
    await asyncio.sleep(0.05)
    return simulator.tick(0.05)
```

Replace it with this:

```python
# REAL HARDWARE MODE
import serial

arduino = serial.Serial('/dev/tty.usbmodem1101', 115200, timeout=1)
# ↑ change this port to whatever Step 2 showed you

async def get_next_delta() -> float:
    loop = asyncio.get_event_loop()
    line = await loop.run_in_executor(None, arduino.readline)
    try:
        return float(line.decode().strip())
    except ValueError:
        return 0.0
```

Then install pyserial:
```bash
pip install pyserial
```

Restart the server:
```bash
uvicorn main:app --reload --port 8000
```

That's it. The Next.js app doesn't change at all — it still just reads from the WebSocket. The data format is identical.

---

## Sanity check

A quick way to confirm the serial data is flowing before touching the server:

```bash
# Mac/Linux
cat /dev/tty.usbmodem1101

# should print a stream of numbers like:
# 4.2
# 4.5
# 3.9
# 23.1   ← you leaned forward
# 24.8
```

If you see that, the swap will work. If you see nothing, check the port name or try re-uploading the firmware.
