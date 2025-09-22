/**
 * Simple WiFi Connection Test
 * Shows clear status of WiFi connection and server communication
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <EEPROM.h>

#define LED_PIN 2
#define BUTTON_PIN 0

struct Config {
  char magic[5];
  char ssid[33];
  char password[64];
  char deviceId[17];
  bool configured;
};

Config config;

void setup() {
  Serial.begin(115200);
  // Wait for serial to initialize
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("WiFi Connection Test");
  Serial.println("========================================");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize EEPROM
  EEPROM.begin(512);
  EEPROM.get(0, config);
  
  Serial.println("\nEEPROM Configuration:");
  Serial.printf("  Magic: %s\n", config.magic);
  Serial.printf("  SSID: %s\n", config.ssid);
  Serial.printf("  Password: %s\n", config.password);
  Serial.printf("  Device ID: %s\n", config.deviceId);
  Serial.printf("  Configured: %s\n", config.configured ? "Yes" : "No");
  
  // Check for factory reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("\nFactory Reset!");
    memset(&config, 0, sizeof(config));
    EEPROM.put(0, config);
    EEPROM.commit();
    Serial.println("Configuration cleared!");
    ESP.restart();
  }
  
  // Try to connect if configured
  if (strcmp(config.magic, "SF01") == 0 && strlen(config.ssid) > 0) {
    Serial.println("\n✓ Valid configuration found!");
    Serial.printf("Connecting to WiFi: %s\n", config.ssid);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(config.ssid, config.password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
      delay(500);
      Serial.print(".");
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ WiFi Connected Successfully!");
      Serial.printf("  IP Address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("  MAC Address: %s\n", WiFi.macAddress().c_str());
      Serial.printf("  RSSI: %d dBm\n", WiFi.RSSI());
      Serial.printf("  Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
      Serial.printf("  DNS: %s\n", WiFi.dnsIP().toString().c_str());
      digitalWrite(LED_PIN, HIGH);
      
      // Test server connection
      Serial.println("\nTesting server connection...");
      HTTPClient http;
      http.begin("http://10.0.0.21:3000/api/device/list");
      int httpCode = http.GET();
      Serial.printf("Server response code: %d\n", httpCode);
      if (httpCode > 0) {
        Serial.println("✅ Server is reachable!");
      } else {
        Serial.println("❌ Server not reachable");
      }
      http.end();
      
    } else {
      Serial.println("\n❌ WiFi Connection Failed!");
      Serial.printf("WiFi Status: %d\n", WiFi.status());
      digitalWrite(LED_PIN, LOW);
    }
  } else {
    Serial.println("\n⚠ No valid configuration found!");
    Serial.println("The WiFiManager should have saved:");
    Serial.println("  - Magic: SF01");
    Serial.println("  - Your WiFi SSID");
    Serial.println("  - Your WiFi Password");
    
    // Blink LED to show no config
    for(int i = 0; i < 10; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }
  
  Serial.println("\n========================================");
  Serial.println("Status Summary:");
  Serial.println("========================================");
  Serial.printf("Config Valid: %s\n", strcmp(config.magic, "SF01") == 0 ? "Yes" : "No");
  Serial.printf("WiFi Connected: %s\n", WiFi.status() == WL_CONNECTED ? "Yes" : "No");
  Serial.printf("LED State: %s\n", digitalRead(LED_PIN) ? "ON (solid)" : "OFF");
  Serial.println("========================================\n");
}

void loop() {
  static unsigned long lastCheck = 0;
  
  // Status check every 5 seconds
  if (millis() - lastCheck > 5000) {
    Serial.printf("[%lu s] WiFi: %s, IP: %s, RSSI: %d dBm, Free Heap: %d bytes\n",
                  millis() / 1000,
                  WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected",
                  WiFi.localIP().toString().c_str(),
                  WiFi.RSSI(),
                  ESP.getFreeHeap());
    lastCheck = millis();
  }
  
  // Heartbeat blink if connected
  if (WiFi.status() == WL_CONNECTED) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 3000) {
      digitalWrite(LED_PIN, LOW);
      delay(50);
      digitalWrite(LED_PIN, HIGH);
      lastBlink = millis();
    }
  }
}
