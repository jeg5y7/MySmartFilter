/**
 * EEPROM Test for ESP32
 * Tests if EEPROM can persist data across power cycles
 */

#include <Arduino.h>
#include <EEPROM.h>
#include <WiFi.h>

#define LED_PIN 2
#define BUTTON_PIN 0
#define EEPROM_SIZE 512

struct TestConfig {
  char magic[5];     // "TEST" + null terminator
  char ssid[33];
  char password[64];
  int bootCount;
  bool configured;
};

TestConfig config;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("EEPROM Persistence Test");
  Serial.println("========================================");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize EEPROM
  if (!EEPROM.begin(EEPROM_SIZE)) {
    Serial.println("ERROR: Failed to initialize EEPROM!");
    while(1) {
      digitalWrite(LED_PIN, millis() % 200 < 100);
    }
  }
  
  Serial.println("EEPROM initialized successfully");
  Serial.printf("EEPROM size: %d bytes\n", EEPROM_SIZE);
  
  // Check for factory reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("\nBOOT button pressed - Factory Reset!");
    
    // Clear EEPROM
    for(int i = 0; i < EEPROM_SIZE; i++) {
      EEPROM.write(i, 0);
    }
    EEPROM.commit();
    
    Serial.println("EEPROM cleared!");
    
    // Blink fast
    for(int i = 0; i < 10; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
    
    ESP.restart();
  }
  
  // Read configuration from EEPROM
  EEPROM.get(0, config);
  
  // Check if this is first boot or valid config
  if (strcmp(config.magic, "TEST") == 0) {
    // Valid configuration found
    config.bootCount++;
    Serial.println("\n✓ Valid configuration found!");
    Serial.printf("  Boot count: %d\n", config.bootCount);
    Serial.printf("  SSID: %s\n", config.ssid);
    Serial.printf("  Password: %s\n", config.password);
    Serial.printf("  Configured: %s\n", config.configured ? "Yes" : "No");
    
    // Save updated boot count
    EEPROM.put(0, config);
    EEPROM.commit();
    Serial.println("✓ Boot count updated and saved");
    
    // Solid LED = has saved config
    digitalWrite(LED_PIN, HIGH);
    
  } else {
    // First boot or corrupted config
    Serial.println("\n⚠ No valid configuration found (first boot?)");
    Serial.println("Creating new configuration...");
    
    // Initialize new config
    strcpy(config.magic, "TEST");
    strcpy(config.ssid, "TestNetwork");
    strcpy(config.password, "TestPassword123");
    config.bootCount = 1;
    config.configured = true;
    
    // Save to EEPROM
    EEPROM.put(0, config);
    if (EEPROM.commit()) {
      Serial.println("✓ New configuration saved to EEPROM!");
      Serial.printf("  Magic: %s\n", config.magic);
      Serial.printf("  SSID: %s\n", config.ssid);
      Serial.printf("  Password: %s\n", config.password);
      Serial.printf("  Boot count: %d\n", config.bootCount);
    } else {
      Serial.println("✗ ERROR: Failed to commit to EEPROM!");
    }
    
    // Blinking LED = new config created
    digitalWrite(LED_PIN, LOW);
  }
  
  Serial.println("\n========================================");
  Serial.println("Test Instructions:");
  Serial.println("1. If LED is SOLID: Config was loaded from EEPROM");
  Serial.println("2. If LED is OFF: New config was just created");
  Serial.println("3. Power cycle the ESP32");
  Serial.println("4. Boot count should increment each time");
  Serial.println("5. Hold BOOT button at startup to factory reset");
  Serial.println("========================================\n");
}

void loop() {
  // Heartbeat - quick blink every 3 seconds
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > 3000) {
    bool ledState = digitalRead(LED_PIN);
    digitalWrite(LED_PIN, LOW);
    delay(50);
    digitalWrite(LED_PIN, ledState);
    lastBlink = millis();
    
    Serial.printf("[%lu] Heartbeat - Boot count: %d, Config valid: %s\n", 
                  millis() / 1000, 
                  config.bootCount,
                  strcmp(config.magic, "TEST") == 0 ? "Yes" : "No");
  }
}
