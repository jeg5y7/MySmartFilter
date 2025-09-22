/**
 * Simple LED Blink Test
 * Verifies ESP32 is running uploaded code
 */

#include <Arduino.h>

#define LED_PIN 2  // Built-in LED on most ESP32 boards

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 Blink Test ===");
  Serial.println("If LED is blinking, upload worked!");
  Serial.println("LED Pin: " + String(LED_PIN));
  Serial.println("========================\n");
  
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  static int count = 0;
  
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON - Count: " + String(count++));
  delay(500);
  
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}
