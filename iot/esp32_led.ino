/*
  RE:518 기억 저장소 ESP32 예시 코드

  역할:
  - 백엔드의 /api/iot/state 주소를 주기적으로 확인합니다.
  - 응답에 들어 있는 ledLevel 값으로 LED 밝기를 바꿉니다.

  준비물:
  - ESP32
  - LED 1개
  - 220옴 저항 1개

  연결:
  - LED 긴 다리: GPIO 5
  - LED 짧은 다리: 저항을 거쳐 GND

  주의:
  - SERVER_URL의 IP는 백엔드를 실행하는 노트북의 같은 와이파이 IP로 바꿔야 합니다.
  - 예: http://192.168.0.12:3001/api/iot/state
*/

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "http://YOUR_NOTEBOOK_IP:3001/api/iot/state";

const int LED_PIN = 5;
const int PWM_CHANNEL = 0;
const int PWM_FREQUENCY = 5000;
const int PWM_RESOLUTION = 8;

int extractLedLevel(String body) {
  int keyIndex = body.indexOf("\"ledLevel\"");

  if (keyIndex < 0) {
    return 0;
  }

  int colonIndex = body.indexOf(":", keyIndex);
  int commaIndex = body.indexOf(",", colonIndex);

  if (commaIndex < 0) {
    commaIndex = body.indexOf("}", colonIndex);
  }

  String value = body.substring(colonIndex + 1, commaIndex);
  value.trim();
  return value.toInt();
}

int brightnessFromLevel(int ledLevel) {
  if (ledLevel <= 0) return 0;
  if (ledLevel == 1) return 70;
  if (ledLevel == 2) return 160;
  return 255;
}

void setup() {
  Serial.begin(115200);

  ledcSetup(PWM_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttachPin(LED_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Wi-Fi connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Wi-Fi connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);

    int statusCode = http.GET();

    if (statusCode == 200) {
      String body = http.getString();
      int ledLevel = extractLedLevel(body);
      int brightness = brightnessFromLevel(ledLevel);

      ledcWrite(PWM_CHANNEL, brightness);

      Serial.print("LED level: ");
      Serial.print(ledLevel);
      Serial.print(" / brightness: ");
      Serial.println(brightness);
    } else {
      Serial.print("Server request failed. HTTP status: ");
      Serial.println(statusCode);
    }

    http.end();
  }

  delay(1000);
}
