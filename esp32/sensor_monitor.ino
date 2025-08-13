#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API configuration
const char* apiUrl = "https://mysmartfilter.com/api/sensor";
const char* userId = "YOUR_USER_ID"; // You'll need to get this from your app
const char* deviceId = "ESP32_SDP810_001"; // Unique device identifier

// SDP810 I2C address
#define SDP810_I2C_ADDRESS 0x25

// Timing configuration
unsigned long lastReading = 0;
const unsigned long readingInterval = 30000; // 30 seconds between readings

// Sensor data structure
struct SensorData {
  float pressure;
  float temperature;
  bool valid;
};

void setup() {
  Serial.begin(115200);
  
  // Initialize I2C
  Wire.begin(21, 22); // SDA=21, SCL=22 for ESP32
  
  // Connect to WiFi
  connectToWiFi();
  
  // Initialize SDP810 sensor
  initializeSDP810();
  
  Serial.println("ESP32 Sensor Monitor Started");
  Serial.println("Device ID: " + String(deviceId));
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }
  
  // Read sensor data every interval
  if (millis() - lastReading >= readingInterval) {
    SensorData data = readSDP810();
    
    if (data.valid) {
      // Print to serial for debugging
      Serial.println("=== Sensor Reading ===");
      Serial.println("Pressure: " + String(data.pressure) + " Pa");
      Serial.println("Temperature: " + String(data.temperature) + " °C");
      
      // Send data to API
      if (sendSensorData(data)) {
        Serial.println("✓ Data sent successfully");
      } else {
        Serial.println("✗ Failed to send data");
      }
    } else {
      Serial.println("✗ Invalid sensor reading");
    }
    
    lastReading = millis();
  }
  
  delay(1000); // Small delay to prevent excessive CPU usage
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.println("IP address: " + WiFi.localIP().toString());
  } else {
    Serial.println();
    Serial.println("WiFi connection failed");
  }
}

void initializeSDP810() {
  // SDP810 initialization sequence
  Wire.beginTransmission(SDP810_I2C_ADDRESS);
  Wire.write(0x36); // Start continuous measurement
  Wire.write(0x03); // Differential pressure, averaging
  int error = Wire.endTransmission();
  
  if (error == 0) {
    Serial.println("SDP810 sensor initialized successfully");
  } else {
    Serial.println("Failed to initialize SDP810 sensor, error: " + String(error));
  }
  
  delay(100); // Wait for sensor to be ready
}

SensorData readSDP810() {
  SensorData data = {0, 0, false};
  
  // Request data from SDP810
  Wire.requestFrom(SDP810_I2C_ADDRESS, 9);
  
  if (Wire.available() >= 9) {
    // Read pressure data (bytes 0-2)
    int16_t pressureRaw = (Wire.read() << 8) | Wire.read();
    uint8_t pressureCRC = Wire.read();
    
    // Read temperature data (bytes 3-5)
    int16_t temperatureRaw = (Wire.read() << 8) | Wire.read();
    uint8_t temperatureCRC = Wire.read();
    
    // Skip scale factor bytes (6-8) for now
    Wire.read(); Wire.read(); Wire.read();
    
    // Convert raw values to actual measurements
    // SDP810 scale factor for differential pressure (Pa)
    data.pressure = pressureRaw / 60.0; // 1/60 Pa per LSB
    
    // Temperature conversion (°C)
    data.temperature = temperatureRaw / 200.0; // 1/200 °C per LSB
    
    data.valid = true;
    
    // Basic sanity check
    if (data.temperature < -40 || data.temperature > 85) {
      data.valid = false;
    }
  } else {
    Serial.println("Not enough data received from SDP810");
  }
  
  return data;
}

bool sendSensorData(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  HTTPClient http;
  http.begin(apiUrl);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["pressure"] = data.pressure;
  doc["temperature"] = data.temperature;
  doc["deviceId"] = deviceId;
  doc["userId"] = userId;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending: " + jsonString);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonString);
  
  bool success = false;
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response: " + String(httpResponseCode));
    Serial.println("Response: " + response);
    
    success = (httpResponseCode == 200);
  } else {
    Serial.println("HTTP Error: " + String(httpResponseCode));
  }
  
  http.end();
  return success;
}

// Helper function to get WiFi signal strength
void printWiFiStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Status: Connected");
    Serial.println("Signal Strength: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println("WiFi Status: Disconnected");
  }
}
