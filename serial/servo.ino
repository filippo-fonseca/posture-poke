/*
  Servo Test — Arduino Nano 33 BLE Sense Rev2

  Listens for Serial commands to move a micro servo.
  Send "SERVO:90" to move to 90°, "SERVO:0" for 0°, etc.

  Does NOTHING until a command is received from Python.
*/

#include <Servo.h>

Servo myServo;

const int SERVO_PIN = 9;

// Serial command buffer
char cmdBuf[32];
int cmdIdx = 0;

void processCommand(const char* cmd) {
  if (strncmp(cmd, "SERVO:", 6) == 0) {
    int angle = atoi(cmd + 6);
    if (angle < 0) angle = 0;
    if (angle > 180) angle = 180;
    myServo.write(angle);

    Serial.print("{\"servo\":");
    Serial.print(angle);
    Serial.println("}");
  }
}

void setup() {
  Serial.begin(115200);
  myServo.attach(SERVO_PIN);
  myServo.write(0);
}

void loop() {
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
}
