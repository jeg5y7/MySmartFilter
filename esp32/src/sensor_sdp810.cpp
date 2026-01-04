/**
 * ESP32 Smart Filter - Sensirion SDP810-125Pa Sensor
 * 
 * Wiring for SDP810:
 * - VDD -> 3.3V (sensor operates at 3.3V)
 * - GND -> GND
 * - SCL -> GPIO 22 (ESP32 I2C clock)
 * - SDA -> GPIO 21 (ESP32 I2C data)
 * 
 * The SDP810 measures differential pressure (±125 Pa range)
 * Perfect for measuring pressure drop across a filter
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
#define SDP810_ADDRESS 0x25  // Default I2C address for SDP810
#define I2C_SDA 21
#define I2C_SCL 22

// SDP810 Commands
#define SDP810_CMD_START_CONT_DIFF_PRESSURE 0x3603  // Start continuous differential pressure measurement
#define SDP810_CMD_STOP_CONT 0x3FF9                  // Stop continuous measurement
#define SDP810_CMD_SOFT_RESET 0x0006                 // Soft reset
#define SDP810_CMD_READ_PRODUCT_ID 0x367C            // Read product ID
#define SDP810_SCALE_FACTOR 60.0                     // Scale factor for SDP810-125Pa

String deviceId = "";
String apiToken = "";
unsigned long lastSend = 0;
unsigned long sendInterval = 10000;  // 10 seconds for testing, change to 30000 for production
bool sensorFound = false;

// Function declarations
void registerDevice();
void sendSensorData();
bool initializeSDP810();
bool readSDP810(float &pressure, float &temperature);
void writeCommand(uint16_t command);
uint8_t crc8(const uint8_t *data, uint8_t len);

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n=== Smart Filter ESP32 - SDP810 Sensor ===");
  Serial.println("Using Sensirion SDP810-125Pa Differential Pressure Sensor");
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);  // 100kHz I2C clock
  Serial.println("\nI2C initialized:");
  Serial.printf("  SDA: GPIO %d\n", I2C_SDA);
  Serial.printf("  SCL: GPIO %d\n", I2C_SCL);
  
  // Initialize SDP810 sensor
  if (initializeSDP810()) {
    Serial.println("✓ SDP810 sensor found and initialized!");
    Serial.println("  Range: ±125 Pa differential pressure");
    
    // Read initial values
    float p, t;
    delay(500);  // Wait for first measurement
    if (readSDP810(p, t)) {
      Serial.printf("  Initial reading: ΔP=%.2f Pa, T=%.2f°C\n", p, t);
    }
  } else {
    Serial.println("⚠ SDP810 sensor not found!");
    Serial.println("Check wiring:");
    Serial.println("  VDD -> 3.3V");
    Serial.println("  GND -> GND");
    Serial.println("  SCL -> GPIO 22");
    Serial.println("  SDA -> GPIO 21");
    Serial.println("\nWill use test data...");
  }
  
  // Generate device ID from MAC
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
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
    
    registerDevice();
    
    Serial.println("\n✓ Setup complete!");
    Serial.printf("Sending sensor data every %d seconds\n", sendInterval/1000);
    Serial.println("\n📊 Differential Pressure Readings:");
    Serial.println("  Positive = Higher pressure on (+) port");
    Serial.println("  Negative = Higher pressure on (-) port");
    Serial.println("  For filter: Connect (+) to upstream, (-) to downstream");
    Serial.println("  Clogged filter will show increasing positive pressure\n");
  } else {
    Serial.println("\n✗ WiFi connection failed!");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastSend >= sendInterval || lastSend == 0) {
      sendSensorData();
      lastSend = now;
    }
  } else {
    Serial.println("WiFi lost, reconnecting...");
    WiFi.reconnect();
    delay(5000);
  }
}

bool initializeSDP810() {
  // Check if sensor is present
  Wire.beginTransmission(SDP810_ADDRESS);
  if (Wire.endTransmission() != 0) {
    // Scan I2C bus to help debug
    Serial.println("\nScanning I2C bus...");
    byte error, address;
    int nDevices = 0;
    
    for(address = 1; address < 127; address++) {
      Wire.beginTransmission(address);
      error = Wire.endTransmission();
      
      if (error == 0) {
        Serial.print("I2C device found at 0x");
        if (address < 16) Serial.print("0");
        Serial.println(address, HEX);
        nDevices++;
      }
    }
    
    if (nDevices == 0) {
      Serial.println("No I2C devices found");
    }
    return false;
  }
  
  // Soft reset the sensor
  writeCommand(SDP810_CMD_SOFT_RESET);
  delay(100);  // Wait for reset
  
  // Stop any ongoing measurement
  writeCommand(SDP810_CMD_STOP_CONT);
  delay(50);
  
  // Start continuous differential pressure measurement with mass flow
  writeCommand(SDP810_CMD_START_CONT_DIFF_PRESSURE);
  delay(100);  // Wait for first measurement
  
  sensorFound = true;
  return true;
}

void writeCommand(uint16_t command) {
  Wire.beginTransmission(SDP810_ADDRESS);
  Wire.write(command >> 8);     // MSB
  Wire.write(command & 0xFF);   // LSB
  Wire.endTransmission();
}

bool readSDP810(float &pressure, float &temperature) {
  if (!sensorFound) {
    // Generate test data
    pressure = 10.0 + (random(-50, 50) / 10.0);  // ±5 Pa variation
    temperature = 22.0 + (random(-30, 30) / 10.0);
    return false;
  }
  
  // Request 9 bytes from sensor
  // 2 bytes pressure + 1 CRC + 2 bytes temp + 1 CRC + 2 bytes scale + 1 CRC
  Wire.requestFrom(SDP810_ADDRESS, 9);
  
  if (Wire.available() < 9) {
    Serial.println("Error: Not enough data from SDP810");
    return false;
  }
  
  // Read pressure data
  uint8_t data[3];
  for (int i = 0; i < 3; i++) {
    data[i] = Wire.read();
  }
  
  // Check CRC for pressure
  if (crc8(data, 2) != data[2]) {
    Serial.println("CRC error on pressure reading");
    return false;
  }
  
  int16_t dp_raw = (int16_t)((data[0] << 8) | data[1]);
  Serial.printf("  [DEBUG] Pressure raw: %d (0x%04X)\n", dp_raw, dp_raw);
  
  // Read temperature data
  for (int i = 0; i < 3; i++) {
    data[i] = Wire.read();
  }
  
  // Check CRC for temperature
  if (crc8(data, 2) != data[2]) {
    Serial.println("CRC error on temperature reading");
    return false;
  }
  
  int16_t temp_raw = (int16_t)((data[0] << 8) | data[1]);
  Serial.printf("  [DEBUG] Temp raw: %d (0x%04X)\n", temp_raw, temp_raw);
  
  // Read and discard scale factor
  for (int i = 0; i < 3; i++) {
    Wire.read();
  }
  
  // Convert raw values
  pressure = dp_raw / SDP810_SCALE_FACTOR;  // Differential pressure in Pa
  temperature = temp_raw / 200.0;  // Temperature in Celsius
  
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
  doc["firmware"] = sensorFound ? "1.0.0-SDP810" : "1.0.0-test";
  
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
      Serial.println("✓ Registered!");
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
  
  // Read sensor data
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
  
  // Display reading
  Serial.printf("[%lus] ", millis()/1000);
  
  if (realData) {
    Serial.print("📊 REAL: ");
    Serial.printf("ΔP=%+.2f Pa", pressure);
    
    // Interpret the pressure for filter status
    if (abs(pressure) < 5.0) {
      Serial.print(" [Clean/No flow]");
    } else if (pressure > 20.0) {
      Serial.print(" [Filter loading]");
    } else if (pressure > 50.0) {
      Serial.print(" [Replace filter soon]");
    } else if (pressure > 100.0) {
      Serial.print(" [⚠ Filter clogged!]");
    }
    
    Serial.printf(", T=%.1f°C", temperature);
  } else {
    Serial.print("🧪 TEST: ");
    Serial.printf("P=%.2f Pa, T=%.1f°C", pressure, temperature);
  }
  
  Serial.print(" ... ");
  
  int code = http.POST(json);
  
  if (code == 200) {
    Serial.println("✓");
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.printf("✗ %d\n", code);
    if (code == 403) {
      Serial.println("  Device not linked to user");
    }
  }
  http.end();
}