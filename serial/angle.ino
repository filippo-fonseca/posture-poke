/*
  Posture Detector Firmware — Serial Version

  Reads the BMI270 accelerometer, calculates pitch and roll,
  and sends tilt data over USB Serial as comma-separated values.
*/

#include "Arduino_BMI270_BMM150.h"
#include <math.h>

const unsigned long INTERVAL_MS = 100;  // 10 Hz

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  if (!IMU.begin()) {
    // Fast blink = IMU failed
    while (1) {
      digitalWrite(LED_BUILTIN, HIGH); delay(200);
      digitalWrite(LED_BUILTIN, LOW);  delay(200);
    }
  }

  digitalWrite(LED_BUILTIN, HIGH);  // solid = ready
}

void loop() {
  static unsigned long lastSend = 0;
  unsigned long now = millis();

  if (now - lastSend < INTERVAL_MS) return;
  lastSend = now;

  float ax, ay, az;
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);

    float pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
    float roll  = atan2(ay, sqrt(ax * ax + az * az)) * 180.0 / PI;

    Serial.print(pitch, 2);
    Serial.print(',');
    Serial.println(roll, 2);
  }
}
