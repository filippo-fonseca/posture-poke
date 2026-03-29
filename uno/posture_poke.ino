/*
  PosturePoke — Combined IMU + Servo Firmware
  Arduino Nano 33 BLE Sense Rev2

  OUTPUT (10 Hz): "pitch,roll\n" — comma-separated accelerometer data
  INPUT:          "SERVO:angle\n" — moves the servo to the given angle (0-180)

  Both share the same USB Serial at 115200 baud.
  The web app reads pitch/roll lines and writes SERVO commands on the same port.
*/

#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <math.h>

// ── Config ──────────────────────────────────────────────────────────────────

const int SERVO_PIN = 9;
const unsigned long INTERVAL_MS = 100;  // 10 Hz IMU output

// ── Globals ─────────────────────────────────────────────────────────────────

Servo myServo;

// Serial command buffer for incoming SERVO commands
char cmdBuf[32];
int cmdIdx = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  // Init servo — start at 0 (retracted)
  myServo.attach(SERVO_PIN);
  myServo.write(0);

  // Init IMU
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
  // ── 1. Check for incoming servo commands (non-blocking) ─────────────────
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (cmdIdx > 0) {
        cmdBuf[cmdIdx] = '\0';
        processCommand(cmdBuf);
        cmdIdx = 0;
      }
    } else if (cmdIdx < (int)sizeof(cmdBuf) - 1) {
      cmdBuf[cmdIdx++] = c;
    }
  }

  // ── 2. Send IMU data at 10 Hz ──────────────────────────────────────────
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

// ── Command handler ─────────────────────────────────────────────────────────

void processCommand(const char* cmd) {
  if (strncmp(cmd, "SERVO:", 6) == 0) {
    int angle = atoi(cmd + 6);
    if (angle < 0) angle = 0;
    if (angle > 180) angle = 180;
    myServo.write(angle);
  }
}
