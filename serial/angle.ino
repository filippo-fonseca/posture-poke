/*
  Posture Detector Firmware — Serial Version

  Reads the BMI270 accelerometer, calculates pitch and roll,
  and sends tilt data over USB Serial as comma-separated values.

  Auto-recovers if the IMU stops responding.
*/

#include "Arduino_BMI270_BMM150.h"
#include <math.h>

const unsigned long INTERVAL_MS = 100;   // 10 Hz
const unsigned long STALE_MS   = 2000;   // re-init IMU if no data for 2s

unsigned long lastSend = 0;
unsigned long lastGoodRead = 0;

void initIMU() {
  if (!IMU.begin()) {
    // Fast blink = IMU failed
    for (int i = 0; i < 10; i++) {
      digitalWrite(LED_BUILTIN, HIGH); delay(100);
      digitalWrite(LED_BUILTIN, LOW);  delay(100);
    }
    return;
  }
  digitalWrite(LED_BUILTIN, HIGH);
  lastGoodRead = millis();
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  initIMU();
}

void loop() {
  unsigned long now = millis();

  // Watchdog: if no successful read for 2s, re-init the IMU
  if (now - lastGoodRead > STALE_MS) {
    IMU.end();
    delay(50);
    initIMU();
  }

  if (now - lastSend < INTERVAL_MS) return;
  lastSend = now;

  float ax, ay, az;
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);
    lastGoodRead = now;

    float pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
    float roll  = atan2(ay, sqrt(ax * ax + az * az)) * 180.0 / PI;

    Serial.print(pitch, 2);
    Serial.print(',');
    Serial.println(roll, 2);
  }
}
