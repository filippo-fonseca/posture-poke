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

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);

  // Init IMU
  if (!IMU.begin()) {
    blinkError();  // fast blink = IMU failed
  }

  // Init BLE
  if (!BLE.begin()) {
    blinkError();  // fast blink = BLE failed
  }

  // Configure BLE advertising
  BLE.setLocalName(DEVICE_NAME);
  BLE.setAdvertisedService(postureService);
  postureService.addCharacteristic(tiltChar);
  BLE.addService(postureService);

  // Start advertising
  BLE.advertise();

  // Solid LED = ready and advertising
  digitalWrite(LED_BUILTIN, HIGH);
}

void loop() {
  static unsigned long lastSend = 0;
  static bool wasConnected = false;

  // CRITICAL: poll the BLE stack every loop iteration.
  // Without this, the library doesn't process disconnect/reconnect events.
  BLE.poll();

  BLEDevice central = BLE.central();

  if (central && central.connected()) {
    // Just connected
    if (!wasConnected) {
      wasConnected = true;
      digitalWrite(LED_BUILTIN, LOW);  // LED off = connected
    }

    unsigned long now = millis();
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
      }
    }
  } else if (wasConnected) {
    // Just disconnected — explicitly restart advertising
    wasConnected = false;
    digitalWrite(LED_BUILTIN, HIGH);  // LED on = advertising
    delay(500);                       // let BLE stack settle
    BLE.advertise();                  // <-- THIS is the key fix
  }
}
