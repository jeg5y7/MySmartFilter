/**
 * Smart Filter ESP32 Firmware
 * Professional version with environment-based configuration
 * 
 * Environments:
 * - esp32-dev: Local development server
 * - esp32-prod: Production server
 * - esp32-test: Test mode without sensor
 * 
 * Build: platformio run -e esp32-dev
 * Upload: platformio run -e esp32-dev -t upload
 * Monitor: platformio run -e esp32-dev -t monitor
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <EEPROM.h>

// Configuration structure for persistent storage
struct Config {
  char magic[4];         // "SF01" to verify valid config
  char ssid[33];         // WiFi SSID
  char password[64];     // WiFi password
  char deviceId[17];     // Device unique ID
  char apiToken[65];     // API authentication token
  bool configured;       // Configuration valid flag
};

// Hardware configuration
#define SDP810_I2C_ADDRESS 0x25
#define LED_PIN 2
#define BUTTON_PIN 0  // BOOT button for factory reset

// Timing configuration
const unsigned long READING_INTERVAL = 30000;        // 30 seconds
const unsigned long STATUS_UPDATE_INTERVAL = 300000; // 5 minutes
const unsigned long RECONNECT_INTERVAL = 60000;      // 1 minute
const unsigned long FACTORY_RESET_TIME = 5000;       // 5 seconds button hold

// API endpoint is defined by build flags
#ifndef API_BASE_URL
  #define API_BASE_URL "http://localhost:3000/api"
#endif

// Global variables
Config config;
unsigned long lastReading = 0;
unsigned long lastStatusUpdate = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long buttonPressTime = 0;
bool wifiConnected = false;
bool sensorInitialized = false;
int failedReadings = 0;
int failedUploads = 0;

// Sensor data structure
struct SensorData {
  float pressure;
  float temperature;
  bool valid;
};

// Function declarations
void loadConfig();
void saveConfig();
void clearConfig();
bool isConfigured();
void factoryReset();
bool connectToWiFi();
void initializeSensor();
SensorData readSensor();
bool registerDevice();
bool sendSensorData(const SensorData& data);
bool updateDeviceStatus();
void handleButton();
void printSystemInfo();
void ledBlink(int times, int duration);
void ledStatus(bool success);

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n================================");
  Serial.println("Smart Filter ESP32 Firmware");
  Serial.println("================================");
  #ifdef ENVIRONMENT
    Serial.printf("Environment: %s\n", ENVIRONMENT);
  #else
    Serial.println("Environment: UNKNOWN");
  #endif
  Serial.printf("API URL: %s\n", API_BASE_URL);
  #ifdef DEBUG_MODE
    Serial.printf("Debug Mode: %s\n", DEBUG_MODE ? "ON" : "OFF");
  #else
    Serial.println("Debug Mode: OFF");
  #endif
  
  // Setup hardware
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize EEPROM
  EEPROM.begin(sizeof(Config));
  loadConfig();
  
  // Initialize I2C for sensor
  Wire.begin(21, 22);
  
  // Check if we're in test mode
  #ifdef TEST_MODE
    Serial.println("*** TEST MODE - Sensor disabled ***");
    // Generate test config if not configured
    if (!isConfigured()) {
      strcpy(config.magic, "SF01");
      strcpy(config.ssid, "TestWiFi");
      strcpy(config.password, "TestPassword");
      strcpy(config.deviceId, "TEST_DEVICE_001");
      strcpy(config.apiToken, "sf_test_token_12345");
      config.configured = true;
      saveConfig();
    }
  #endif
  
  // Connect to WiFi if configured
  if (isConfigured()) {
    Serial.println("Configuration found, connecting to WiFi...");
    if (connectToWiFi()) {
      wifiConnected = true;
      
      // Register device if no token
      if (strlen(config.apiToken) == 0) {
        registerDevice();
      }
      
      // Initialize sensor
      #ifndef SKIP_SENSOR
        initializeSensor();
      #else
        Serial.println("Sensor initialization skipped (test mode)");
        sensorInitialized = true;
      #endif
      
      // Update device status
      updateDeviceStatus();
      
      Serial.println("Setup complete!");
      ledBlink(3, 100);
    } else {
      Serial.println("WiFi connection failed!");
      ledBlink(5, 200);
    }
  } else {
    Serial.println("No configuration found!");
    Serial.println("Please configure device using WiFi Manager mode");
    ledBlink(10, 100);
  }
  
  printSystemInfo();
}

void loop() {
  // Handle factory reset button
  handleButton();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi disconnected!");
      wifiConnected = false;
    }
    
    // Try to reconnect periodically
    if (millis() - lastReconnectAttempt >= RECONNECT_INTERVAL) {
      Serial.println("Attempting to reconnect...");
      wifiConnected = connectToWiFi();
      lastReconnectAttempt = millis();
    }
    
    // Blink LED to indicate no connection
    digitalWrite(LED_PIN, (millis() / 1000) % 2);
    delay(100);
    return;
  }
  
  wifiConnected = true;
  
  // Read and send sensor data
  if (millis() - lastReading >= READING_INTERVAL) {
    SensorData data;
    
    #ifndef SKIP_SENSOR
      data = readSensor();
    #else
      // Generate test data
      data.pressure = 10.0 + random(-50, 50) / 10.0;
      data.temperature = 22.0 + random(-20, 20) / 10.0;
      data.valid = true;
    #endif
    
    if (data.valid) {
      failedReadings = 0;
      
      #ifdef DEBUG_MODE
        Serial.printf("\n=== Sensor Reading ===\n");
        Serial.printf("Pressure: %.2f Pa\n", data.pressure);
        Serial.printf("Temperature: %.2f °C\n", data.temperature);
      #endif
      
      if (sendSensorData(data)) {
        Serial.println("✓ Data sent successfully");
        ledStatus(true);
        failedUploads = 0;
      } else {
        Serial.println("✗ Failed to send data");
        ledStatus(false);
        failedUploads++;
        
        // Re-register device if too many failures
        if (failedUploads > 5) {
          Serial.println("Too many upload failures, re-registering device...");
          registerDevice();
          failedUploads = 0;
        }
      }
    } else {
      Serial.println("✗ Invalid sensor reading");
      failedReadings++;
      
      // Reinitialize sensor if too many failures
      #ifndef TEST_MODE
      if (failedReadings > 5) {
        Serial.println("Too many failed readings, reinitializing sensor...");
        initializeSensor();
        failedReadings = 0;
      }
      #endif
    }
    
    lastReading = millis();
  }
  
  // Update device status periodically
  if (millis() - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
    updateDeviceStatus();
    lastStatusUpdate = millis();
  }
  
  delay(100);
}

// Configuration management
void loadConfig() {
  EEPROM.get(0, config);
  if (strcmp(config.magic, "SF01") != 0) {
    clearConfig();
  }
}

void saveConfig() {
  EEPROM.put(0, config);
  EEPROM.commit();
}

void clearConfig() {
  memset(&config, 0, sizeof(config));
  saveConfig();
}

bool isConfigured() {
  return strcmp(config.magic, "SF01") == 0 && config.configured;
}

void factoryReset() {
  Serial.println("\n*** FACTORY RESET ***");
  clearConfig();
  ledBlink(10, 50);
  ESP.restart();
}

// WiFi connection
bool connectToWiFi() {
  if (strlen(config.ssid) == 0) {
    return false;
  }
  
  Serial.printf("Connecting to WiFi: %s", config.ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.printf("IP address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Signal: %d dBm\n", WiFi.RSSI());
    digitalWrite(LED_PIN, LOW);
    return true;
  }
  
  Serial.println("\n✗ WiFi connection failed");
  return false;
}

// Sensor functions
void initializeSensor() {
  Serial.print("Initializing SDP810 sensor...");
  
  Wire.beginTransmission(SDP810_I2C_ADDRESS);
  Wire.write(0x36);  // Start continuous measurement
  Wire.write(0x03);  // Differential pressure with averaging
  int error = Wire.endTransmission();
  
  if (error == 0) {
    Serial.println(" ✓ Success");
    sensorInitialized = true;
  } else {
    Serial.printf(" ✗ Failed (error %d)\n", error);
    sensorInitialized = false;
  }
  
  delay(100);
}

SensorData readSensor() {
  SensorData data = {0, 0, false};
  
  if (!sensorInitialized) {
    return data;
  }
  
  Wire.requestFrom(SDP810_I2C_ADDRESS, 9);
  
  if (Wire.available() >= 9) {
    int16_t pressureRaw = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC
    
    int16_t temperatureRaw = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC
    
    Wire.read(); Wire.read(); Wire.read(); // Scale factors
    
    data.pressure = pressureRaw / 60.0;
    data.temperature = temperatureRaw / 200.0;
    
    // Sanity check
    if (data.temperature >= -40 && data.temperature <= 85) {
      data.valid = true;
    }
  }
  
  return data;
}

// API functions
bool registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  Serial.println("Registering device...");
  
  HTTPClient http;
  String url = API_BASE_URL;
  url += "/device/register";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = "2.0.0";  // PlatformIO version
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument responseDoc;
    deserializeJson(responseDoc, response);
    
    if (responseDoc["token"]) {
      const char* token = responseDoc["token"];
      strncpy(config.apiToken, token, sizeof(config.apiToken) - 1);
      saveConfig();
      Serial.println("✓ Device registered");
      http.end();
      return true;
    }
  }
  
  Serial.printf("✗ Registration failed (HTTP %d)\n", httpCode);
  http.end();
  return false;
}

bool sendSensorData(const SensorData& data) {
  if (WiFi.status() != WL_CONNECTED || strlen(config.apiToken) == 0) {
    return false;
  }
  
  HTTPClient http;
  String url = API_BASE_URL;
  url += "/sensor";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  JsonDocument doc;
  doc["pressure"] = data.pressure;
  doc["temperature"] = data.temperature;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  #ifdef DEBUG_MODE
    Serial.println("Sending: " + jsonString);
  #endif
  
  int httpCode = http.POST(jsonString);
  bool success = (httpCode == 200);
  
  if (!success && httpCode == 401) {
    // Token invalid, try to re-register
    memset(config.apiToken, 0, sizeof(config.apiToken));
    saveConfig();
    registerDevice();
  }
  
  http.end();
  return success;
}

bool updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || strlen(config.apiToken) == 0) {
    return false;
  }
  
  Serial.print("Updating device status...");
  
  HTTPClient http;
  String url = API_BASE_URL;
  url += "/device/status";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  JsonDocument doc;
  doc["status"] = "active";
  doc["firmware"] = "2.0.0";
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.PUT(jsonString);
  bool success = (httpCode == 200);
  
  Serial.println(success ? " ✓" : " ✗");
  http.end();
  return success;
}

// Utility functions
void handleButton() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (buttonPressTime == 0) {
      buttonPressTime = millis();
    } else if (millis() - buttonPressTime >= FACTORY_RESET_TIME) {
      factoryReset();
    }
  } else {
    buttonPressTime = 0;
  }
}

void printSystemInfo() {
  Serial.println("\n=== System Information ===");
  Serial.printf("Device ID: %s\n", config.deviceId);
  Serial.printf("Firmware: 2.0.0\n");
  Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Chip ID: %08X\n", (uint32_t)ESP.getEfuseMac());
  Serial.printf("SDK Version: %s\n", ESP.getSdkVersion());
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi: Connected\n");
    Serial.printf("SSID: %s\n", WiFi.SSID().c_str());
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("WiFi: Disconnected");
  }
  
  Serial.printf("Sensor: %s\n", sensorInitialized ? "Ready" : "Not initialized");
  Serial.println("==========================\n");
}

void ledBlink(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_PIN, LOW);
    delay(duration);
  }
}

void ledStatus(bool success) {
  if (success) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
  } else {
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(50);
      digitalWrite(LED_PIN, LOW);
      delay(50);
    }
  }
}
