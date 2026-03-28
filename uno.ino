/*
  Posture Detector Firmware — Arduino Nano 33 BLE Sense Rev2 (Wireless)

  Reads the BMI270 accelerometer, calculates pitch and roll,
  and broadcasts tilt data over Bluetooth Low Energy (BLE).

  Flash this ONCE via USB, then unplug and run on battery.
  The Python companion script connects wirelessly to read data.

  BLE Service UUID:  19B10000-E8F2-537E-4F6C-D104768A1214
  Characteristics:
    - Tilt (notify): 19B10001-...  → 8-byte packet [pitch_f32, roll_f32]
*/

#include "Arduino_BMI270_BMM150.h"
#include <ArduinoBLE.h>
#include <math.h>

// ── BLE UUIDs ────────────────────────────────────────────────
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define TILT_CHAR_UUID      "19B10001-E8F2-537E-4F6C-D104768A1214"

// ── Config ───────────────────────────────────────────────────
const unsigned long INTERVAL_MS = 100;  // 10 Hz updates
const char DEVICE_NAME[] = "PostureDetector";

// ── BLE objects ──────────────────────────────────────────────
BLEService postureService(SERVICE_UUID);
// 8 bytes: pitch (float32) + roll (float32)
BLECharacteristic tiltChar(TILT_CHAR_UUID, BLERead | BLENotify, 8);

// ── Status LED ───────────────────────────────────────────────
void blinkError() {
  while (1) {
    digitalWrite(LED_BUILTIN, HIGH); delay(200);
    digitalWrite(LED_BUILTIN, LOW);  delay(200);
  }
}

// ── BLE init helper (called on startup + after every disconnect) ──
void initBLE() {
  if (!BLE.begin()) {
    blinkError();
  }

  BLE.setLocalName(DEVICE_NAME);
  BLE.setAdvertisedService(postureService);
  postureService.addCharacteristic(tiltChar);
  BLE.addService(postureService);
  BLE.advertise();

  digitalWrite(LED_BUILTIN, HIGH);  // LED on = advertising
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);

  // Init IMU (only once — survives BLE resets)
  if (!IMU.begin()) {
    blinkError();
  }

  initBLE();
}

void loop() {
  static unsigned long lastSend = 0;
  static bool wasConnected = false;
  static unsigned long lastDataTime = 0;

  BLE.poll();

  BLEDevice central = BLE.central();

  if (central && central.connected()) {
    if (!wasConnected) {
      wasConnected = true;
      lastDataTime = millis();
      digitalWrite(LED_BUILTIN, LOW);  // LED off = connected
    }

    unsigned long now = millis();

    // Watchdog: if connected but no data sent for 5s, assume stuck
    if (now - lastDataTime > 5000) {
      // Force full BLE reset — nuclear option from the forums
      wasConnected = false;
      BLE.disconnect();
      BLE.end();
      delay(500);
      initBLE();
      return;
    }

    if (now - lastSend >= INTERVAL_MS) {
      lastSend = now;

      float ax, ay, az;
      if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(ax, ay, az);

        float pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
        float roll  = atan2(ay, sqrt(ax * ax + az * az)) * 180.0 / PI;

        uint8_t buf[8];
        memcpy(buf,     &pitch, 4);
        memcpy(buf + 4, &roll,  4);
        tiltChar.writeValue(buf, 8);

        lastDataTime = now;  // reset watchdog
      }
    }
  } else if (wasConnected) {
    // Disconnect detected — full BLE stack teardown and reinit
    wasConnected = false;
    digitalWrite(LED_BUILTIN, HIGH);

    BLE.end();        // tear down the entire BLE stack
    delay(500);       // let the radio settle
    initBLE();        // rebuild from scratch — fresh advertising
  }
}
