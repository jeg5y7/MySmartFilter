/**
 * ESP32 Smart Filter - Sensirion SDP810-125Pa Sensor (Version 2)
 * Fixed initialization sequence and error handling
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

// ============= WIFI CONFIGURATION =============
const char* WIFI_SSID = "BeMyPillow";
const char* WIFI_PASSWORD = "4252417380";
// ==============================================

const char* SERVER_URL = "http://10.0.0.21:3000/api";
#define LED_PIN 2

// SDP810 I2C Configuration
#define SDP810_ADDRESS 0x25
#define I2C_SDA 21
#define I2C_SCL 22

String deviceId = "";
String apiToken = "";
unsigned long lastSend = 0;
unsigned long sendInterval = 5000;  // 5 seconds for testing
bool sensorFound = false;

// Function declarations
void registerDevice();
void sendSensorData();
bool initializeSDP810();
bool readSDP810(float &pressure, float &temperature);
uint8_t crc8(const uint8_t *data, uint8_t len);

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n=== Smart Filter ESP32 - SDP810 v2 ===");
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize I2C with explicit settings
  pinMode(I2C_SDA, INPUT_PULLUP);  // Enable internal pullup
  pinMode(I2C_SCL, INPUT_PULLUP);  // Enable internal pullup
  delay(10);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);  // Try 50kHz for better reliability
  delay(100);  // Let I2C stabilize
  
  // Initialize SDP810
  if (initializeSDP810()) {
    Serial.println("✓ SDP810 initialized successfully!");
    delay(100);  // Let sensor stabilize
    
    // Do a test read
    float p, t;
    if (readSDP810(p, t)) {
      Serial.printf("  Test read: ΔP=%.2f Pa, T=%.2f°C\n", p, t);
      if (abs(p) < 1.0) {
        Serial.println("  ✓ Sensor reading looks good (near zero with tubes open)");
      }
    }
  } else {
    Serial.println("⚠ SDP810 not found or initialization failed");
  }
  
  // Generate device ID
  uint8_t mac[6];
  WiFi.macAddress(mac);
  deviceId = "SF";
  for (int i = 0; i < 6; i++) {
    char hex[3];
    sprintf(hex, "%02X", mac[i]);
    deviceId += hex;
  }
  Serial.print("\nDevice ID: ");
  Serial.println(deviceId);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("\nConnecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, (attempts % 2));
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    digitalWrite(LED_PIN, HIGH);
    registerDevice();
    Serial.println("\n📊 Monitoring differential pressure...");
    Serial.println("With tubes open to air, pressure should be ~0 Pa");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastSend >= sendInterval) {
      sendSensorData();
      lastSend = millis();
    }
  }
}

bool initializeSDP810() {
  Serial.println("\nInitializing SDP810...");
  
  // Check if sensor is present
  Wire.beginTransmission(SDP810_ADDRESS);
  if (Wire.endTransmission() != 0) {
    Serial.println("  ✗ No device at 0x25");
    return false;
  }
  Serial.println("  ✓ Device found at 0x25");
  
  // Skip soft reset - it seems to fail on some sensors
  // Just proceed with stopping and restarting measurement
  
  // Clear any pending data
  Wire.requestFrom(SDP810_ADDRESS, 9);
  while(Wire.available()) {
    Wire.read();  // Discard
  }
  
  // Stop any continuous measurement (0x3FF9)
  Serial.println("  Stopping any active measurement...");
  Wire.beginTransmission(SDP810_ADDRESS);
  Wire.write(0x3F);
  Wire.write(0xF9);
  Wire.endTransmission();
  delay(50);
  
  // Clear buffer again
  Wire.requestFrom(SDP810_ADDRESS, 9);
  while(Wire.available()) {
    Wire.read();  // Discard
  }
  
  // Start continuous differential pressure measurement (0x3603)
  Serial.println("  Starting continuous measurement...");
  Wire.beginTransmission(SDP810_ADDRESS);
  Wire.write(0x36);
  Wire.write(0x03);
  if (Wire.endTransmission() != 0) {
    Serial.println("    ✗ Failed to start measurement");
    return false;
  }
  
  delay(20);  // Wait for first measurement (8ms typical)
  
  // Try to read first measurement to verify it's working
  Wire.requestFrom(SDP810_ADDRESS, 9);
  int available = Wire.available();
  
  if (available < 9) {
    Serial.printf("    ✗ Only %d bytes available (expected 9)\n", available);
    // Clear buffer
    while(Wire.available()) Wire.read();
    return false;
  }
  
  // Read and check first two bytes
  byte b1 = Wire.read();
  byte b2 = Wire.read();
  
  // Clear rest of buffer
  while(Wire.available()) Wire.read();
  
  // Check if we got error code (0x80 0x00)
  if (b1 == 0x80 && b2 == 0x00) {
    Serial.println("    ⚠ Sensor returning error code 0x8000");
    Serial.println("    Attempting alternate initialization...");
    
    // Try mass flow mode instead (0x3608)
    Wire.beginTransmission(SDP810_ADDRESS);
    Wire.write(0x36);
    Wire.write(0x08);  // Mass flow average mode
    Wire.endTransmission();
    delay(20);
    
    // Check again
    Wire.requestFrom(SDP810_ADDRESS, 9);
    if (Wire.available() >= 2) {
      b1 = Wire.read();
      b2 = Wire.read();
      while(Wire.available()) Wire.read();
      
      if (b1 == 0x80 && b2 == 0x00) {
        Serial.println("    Still getting error - sensor may need service");
        return false;
      }
    }
  }
  
  Serial.printf("    First bytes: 0x%02X 0x%02X\n", b1, b2);
  sensorFound = true;
  return true;
}

bool readSDP810(float &pressure, float &temperature) {
  if (!sensorFound) {
    // Test data
    pressure = random(-10, 10) / 10.0;
    temperature = 22.0 + (random(-20, 20) / 10.0);
    return false;
  }
  
  // Request 9 bytes
  Wire.requestFrom(SDP810_ADDRESS, 9);
  
  if (Wire.available() < 9) {
    Serial.println("Read error: insufficient data");
    return false;
  }
  
  // Read all 9 bytes
  byte data[9];
  for (int i = 0; i < 9; i++) {
    data[i] = Wire.read();
  }
  
  // Check for error code
  if (data[0] == 0x80 && data[1] == 0x00) {
    Serial.println("Sensor error 0x8000 - check tubes/ports");
    // Try to restart measurement
    initializeSDP810();
    return false;
  }
  
  // Verify CRCs
  if (crc8(&data[0], 2) != data[2]) {
    Serial.println("CRC error on pressure");
    return false;
  }
  
  if (crc8(&data[3], 2) != data[5]) {
    Serial.println("CRC error on temperature");
    return false;
  }
  
  // Convert values
  int16_t dp_raw = (int16_t)((data[0] << 8) | data[1]);
  int16_t temp_raw = (int16_t)((data[3] << 8) | data[4]);
  int16_t scale_raw = (int16_t)((data[6] << 8) | data[7]);
  
  // Use the scale factor from sensor (typically 60 for SDP810-125Pa)
  float scale = (scale_raw > 0) ? scale_raw : 60.0;
  
  pressure = dp_raw / scale;
  temperature = temp_raw / 200.0;
  
  // Sanity check
  if (abs(pressure) > 125.0) {
    Serial.printf("Warning: Pressure %.1f Pa exceeds sensor range\n", pressure);
  }
  
  return true;
}

uint8_t crc8(const uint8_t *data, uint8_t len) {
  uint8_t crc = 0xFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = (crc << 1) ^ 0x31;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc;
}

void registerDevice() {
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/device/register");
  http.addHeader("Content-Type", "application/json");
  
  JsonDocument doc;
  doc["deviceId"] = deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = sensorFound ? "2.0.0-SDP810" : "2.0.0-test";
  
  String json;
  serializeJson(doc, json);
  
  Serial.print("Registering device... ");
  int code = http.POST(json);
  
  if (code == 200) {
    String response = http.getString();
    JsonDocument resp;
    deserializeJson(resp, response);
    
    if (resp["success"]) {
      apiToken = resp["token"].as<String>();
      Serial.println("✓");
    }
  } else {
    Serial.printf("Failed: %d\n", code);
  }
  http.end();
}

void sendSensorData() {
  if (apiToken.length() == 0) {
    registerDevice();
    if (apiToken.length() == 0) return;
  }
  
  float pressure, temperature;
  bool realData = readSDP810(pressure, temperature);
  
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/sensor");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + apiToken);
  
  JsonDocument doc;
  doc["pressure"] = pressure;
  doc["temperature"] = temperature;
  
  String json;
  serializeJson(doc, json);
  
  Serial.printf("[%lus] ", millis()/1000);
  
  if (realData) {
    Serial.print("📊 ");
    
    // Show differential pressure with interpretation
    if (abs(pressure) < 0.5) {
      Serial.printf("ΔP=%+.2f Pa [No flow/Open]", pressure);
    } else if (pressure > 0) {
      Serial.printf("ΔP=%+.2f Pa [Flow detected]", pressure);
      if (pressure > 50) Serial.print(" ⚠️");
    } else {
      Serial.printf("ΔP=%+.2f Pa [Reverse?]", pressure);
    }
    
    Serial.printf(", T=%.1f°C", temperature);
  } else {
    Serial.printf("🧪 P=%.1f T=%.1f", pressure, temperature);
  }
  
  Serial.print(" ... ");
  
  int code = http.POST(json);
  if (code == 200) {
    Serial.println("✓");
    digitalWrite(LED_PIN, LOW);
    delay(50);
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.printf("✗ %d\n", code);
  }
  http.end();
}