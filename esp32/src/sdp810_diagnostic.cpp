/**
 * SDP810 Diagnostic Tool
 * Verifies I2C connection and SDP810 sensor communication
 */

#include <Arduino.h>
#include <Wire.h>

#define I2C_SDA 21  // D21
#define I2C_SCL 22  // D22

void scanI2C();
void testSDP810();
void readProductID();

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("    SDP810 DIAGNOSTIC TOOL");
  Serial.println("========================================");
  Serial.println("\nWiring Check:");
  Serial.println("  ESP32 D21 (GPIO21) -> SDP810 SDA");
  Serial.println("  ESP32 D22 (GPIO22) -> SDP810 SCL");
  Serial.println("  ESP32 3.3V -> SDP810 VDD");
  Serial.println("  ESP32 GND -> SDP810 GND");
  Serial.println("========================================\n");
  
  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);  // 100kHz
  
  Serial.println("1. Scanning I2C bus...");
  scanI2C();
  
  Serial.println("\n2. Testing SDP810 at address 0x25...");
  testSDP810();
  
  Serial.println("\n3. Reading Product ID...");
  readProductID();
  
  Serial.println("\n========================================");
  Serial.println("Diagnostic complete!");
}

void loop() {
  // Just scan every 5 seconds
  delay(5000);
  Serial.println("\n--- Periodic I2C Scan ---");
  scanI2C();
}

void scanI2C() {
  byte error, address;
  int nDevices = 0;
  
  Serial.println("Scanning I2C addresses 0x01 to 0x7F...");
  
  for(address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("  ✓ Device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      
      // Identify known devices
      if (address == 0x25) Serial.print(" <- SDP810 (Expected!)");
      else if (address == 0x26) Serial.print(" <- Might be SDP810 with alt address");
      else if (address == 0x40) Serial.print(" <- Might be HTU21D/SHT21");
      else if (address == 0x76 || address == 0x77) Serial.print(" <- Might be BMP280/BME280");
      
      Serial.println();
      nDevices++;
    } else if (error == 4) {
      Serial.print("  ✗ Error at address 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }
  
  if (nDevices == 0) {
    Serial.println("  ⚠ No I2C devices found!");
    Serial.println("  Check wiring - ensure SDA/SCL have pull-up resistors");
  } else {
    Serial.print("  Found ");
    Serial.print(nDevices);
    Serial.println(" device(s)");
  }
}

void testSDP810() {
  const byte SDP810_ADDR = 0x25;
  
  // Check if device responds
  Wire.beginTransmission(SDP810_ADDR);
  byte error = Wire.endTransmission();
  
  if (error != 0) {
    Serial.println("  ✗ SDP810 not responding at 0x25");
    Serial.print("  Error code: ");
    Serial.println(error);
    return;
  }
  
  Serial.println("  ✓ SDP810 ACK received at 0x25");
  
  // Try to stop continuous measurement (in case it's running)
  Serial.println("  Sending STOP command (0x3FF9)...");
  Wire.beginTransmission(SDP810_ADDR);
  Wire.write(0x3F);  // MSB
  Wire.write(0xF9);  // LSB
  error = Wire.endTransmission();
  Serial.print("    Result: ");
  Serial.println(error == 0 ? "Success" : "Failed");
  
  delay(50);
  
  // Try to read data (might get old data or error)
  Serial.println("  Attempting to read 9 bytes...");
  Wire.requestFrom(SDP810_ADDR, 9);
  
  int available = Wire.available();
  Serial.print("    Bytes available: ");
  Serial.println(available);
  
  if (available > 0) {
    Serial.print("    Data: ");
    for (int i = 0; i < available; i++) {
      byte b = Wire.read();
      Serial.print("0x");
      if (b < 16) Serial.print("0");
      Serial.print(b, HEX);
      Serial.print(" ");
    }
    Serial.println();
    
    // Interpret if we got 9 bytes
    if (available >= 9) {
      Serial.println("    Interpretation:");
      Serial.println("    - Bytes 0-1: Pressure value");
      Serial.println("    - Byte 2: Pressure CRC");
      Serial.println("    - Bytes 3-4: Temperature value");
      Serial.println("    - Byte 5: Temperature CRC");
      Serial.println("    - Bytes 6-7: Scale factor");
      Serial.println("    - Byte 8: Scale CRC");
      
      // Check for error pattern
      Serial.println("\n  Note: 0x80 0x00 indicates sensor error/overflow");
    }
  }
}

void readProductID() {
  const byte SDP810_ADDR = 0x25;
  
  // Send read product ID command
  Serial.println("  Sending READ_PRODUCT_ID command (0x367C)...");
  Wire.beginTransmission(SDP810_ADDR);
  Wire.write(0x36);
  Wire.write(0x7C);
  byte error = Wire.endTransmission();
  
  if (error != 0) {
    Serial.print("  ✗ Failed to send command, error: ");
    Serial.println(error);
    return;
  }
  
  delay(50);  // Wait for response
  
  // Product ID response should be 18 bytes
  Wire.requestFrom(SDP810_ADDR, 18);
  int available = Wire.available();
  
  Serial.print("  Bytes available: ");
  Serial.println(available);
  
  if (available > 0) {
    Serial.print("  Product ID data: ");
    byte product[18];
    for (int i = 0; i < available && i < 18; i++) {
      product[i] = Wire.read();
      Serial.print("0x");
      if (product[i] < 16) Serial.print("0");
      Serial.print(product[i], HEX);
      Serial.print(" ");
    }
    Serial.println();
    
    if (available >= 18) {
      // First 4 bytes should be product number
      uint32_t productNum = ((uint32_t)product[0] << 24) | 
                           ((uint32_t)product[1] << 16) |
                           ((uint32_t)product[2] << 8) | 
                           product[3];
      Serial.print("  Product Number: ");
      Serial.println(productNum);
      
      // Check if it matches SDP810
      if (productNum == 0x03020A00 || productNum == 0x03020A01) {
        Serial.println("  ✓ Confirmed as SDP810!");
      }
    }
  }
}