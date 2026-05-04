const int BULB_CONTROL_PIN = 5;

int brightnessFromLevel(int level) {
  if (level <= 0) return 0;
  if (level == 1) return 120;
  if (level == 2) return 200;
  return 255;
}

void setup() {
  Serial.begin(9600);
  pinMode(BULB_CONTROL_PIN, OUTPUT);
  analogWrite(BULB_CONTROL_PIN, 0);

  Serial.println("Arduino ready");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    int level = input.toInt();

    if (level < 0) level = 0;
    if (level > 3) level = 3;

    int brightness = brightnessFromLevel(level);
    analogWrite(BULB_CONTROL_PIN, brightness);

    Serial.print("Level: ");
    Serial.print(level);
    Serial.print(" / Brightness: ");
    Serial.println(brightness);
  }
}
