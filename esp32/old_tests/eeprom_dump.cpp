/**
 * EEPROM Dump Utility
 * Shows raw contents of EEPROM to debug storage issues
 */

#include <Arduino.h>
#include <EEPROM.h>

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("EEPROM Contents Dump");
  Serial.println("========================================\n");
  
  // Initialize EEPROM
  if (!EEPROM.begin(512)) {
    Serial.println("ERROR: Failed to initialize EEPROM!");
    return;
  }
  
  // Show first 200 bytes in hex and ASCII
  Serial.println("Offset  Hex                                              ASCII");
  Serial.println("------  -----------------------------------------------  ----------------");
  
  for (int row = 0; row < 13; row++) {  // Show first 200 bytes (13 rows of 16)
    Serial.printf("0x%04X  ", row * 16);
    
    // Hex values
    for (int col = 0; col < 16; col++) {
      int offset = row * 16 + col;
      if (offset < 200) {
        byte value = EEPROM.read(offset);
        Serial.printf("%02X ", value);
      } else {
        Serial.print("   ");
      }
    }
    
    Serial.print(" ");
    
    // ASCII representation
    for (int col = 0; col < 16; col++) {
      int offset = row * 16 + col;
      if (offset < 200) {
        byte value = EEPROM.read(offset);
        if (value >= 32 && value <= 126) {
          Serial.printf("%c", value);
        } else {
          Serial.print(".");
        }
      }
    }
    
    Serial.println();
  }
  
  Serial.println("\n========================================");
  Serial.println("Checking for known structures:");
  Serial.println("========================================");
  
  // Check for magic strings
  char magic[6];
  EEPROM.get(0, magic);
  magic[5] = '\0';
  Serial.printf("Magic at offset 0: '%s' (hex: ", magic);
  for (int i = 0; i < 5; i++) {
    Serial.printf("%02X ", magic[i]);
  }
  Serial.println(")");
  
  // Check for SSID
  char ssid[33];
  EEPROM.get(5, ssid);
  ssid[32] = '\0';
  Serial.printf("SSID at offset 5: '%s'\n", ssid);
  
  // Check for device ID patterns
  char deviceId[17];
  EEPROM.get(102, deviceId);
  deviceId[16] = '\0';
  Serial.printf("Device ID at offset 102: '%s'\n", deviceId);
  
  Serial.println("\n========================================");
  Serial.println("Analysis:");
  Serial.println("========================================");
  
  if (strcmp(magic, "SF01") == 0) {
    Serial.println("✓ Found SF01 magic string - WiFiManager config present");
  } else if (strcmp(magic, "TEST") == 0) {
    Serial.println("✓ Found TEST magic string - EEPROM test config present");
  } else {
    Serial.println("✗ No recognized configuration found");
    Serial.println("  EEPROM may be empty or corrupted");
  }
  
  // Count non-zero bytes
  int nonZeroCount = 0;
  for (int i = 0; i < 512; i++) {
    if (EEPROM.read(i) != 0) nonZeroCount++;
  }
  Serial.printf("\nNon-zero bytes: %d / 512 (%.1f%% used)\n", 
                nonZeroCount, (nonZeroCount * 100.0) / 512);
}

void loop() {
  // Nothing to do
}
