/**
 * Smart Filter Final Production Version
 * - WiFi connection with persistent configuration
 * - Server registration and authentication
 * - Sensor data transmission every 30 seconds
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

#define LED_PIN 2
#define BUTTON_PIN 0
#define EEPROM_SIZE 512

// Server configuration
const char* SERVER_URL = "http://10.0.0.21:3000/api";

// Configuration structure
struct Config {
  char magic[5];      // "WIFI" + null
  char ssid[33];      
  char password[64];
  char deviceId[17];  // Device unique ID
  char apiToken[68];  // API authentication token (sf_ + 64 hex chars + null)
};

Config config;
WebServer server(80);
DNSServer dnsServer;
const byte DNS_PORT = 53;

// Timing variables
unsigned long lastDataSend = 0;
unsigned long lastStatusUpdate = 0;
const unsigned long DATA_SEND_INTERVAL = 30000;  // 30 seconds
const unsigned long STATUS_UPDATE_INTERVAL = 300000;  // 5 minutes

// Forward declarations
void startAPMode();
void handleRoot();
void handleSave();
bool connectToWiFi();
void loadConfig();
void saveConfig();
bool isConfigured();
void factoryReset();
void generateDeviceId();
bool registerDevice();
bool sendSensorData();
bool updateDeviceStatus();

// Simple HTML page for WiFi setup
const char* setupHTML = R"(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Smart Filter Setup</title>
  <style>
    body { font-family: Arial; margin: 20px; background: #f0f0f0; }
    .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
    h2 { color: #333; }
    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
    button { width: 100%; padding: 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
    button:hover { background: #45a049; }
    .info { background: #e3f2fd; padding: 10px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔧 Smart Filter Setup</h2>
    <div class="info">
      <strong>Device ID:</strong> <span style="font-family: monospace;">%DEVICE_ID%</span>
    </div>
    <form action="/save" method="POST">
      <label>WiFi Network (SSID):</label>
      <input type="text" name="ssid" required placeholder="Your WiFi network name">
      <label>WiFi Password:</label>
      <input type="password" name="password" required placeholder="Your WiFi password">
      <button type="submit">Save & Connect</button>
    </form>
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      After connecting, visit <a href="http://10.0.0.21:3000/devices">http://10.0.0.21:3000/devices</a> 
      to link this device to your account.
    </p>
  </div>
</body>
</html>
)";

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("Smart Filter - Production Version");
  Serial.println("========================================");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  loadConfig();
  
  // Generate device ID if we don't have one
  if (strlen(config.deviceId) == 0) {
    generateDeviceId();
    saveConfig();
  }
  
  Serial.printf("Device ID: %s\n", config.deviceId);
  
  // Check for factory reset (hold BOOT button for 5 seconds)
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("BOOT button pressed, hold for 5 seconds to factory reset...");
    unsigned long pressStart = millis();
    while (digitalRead(BUTTON_PIN) == LOW && millis() - pressStart < 5000) {
      digitalWrite(LED_PIN, (millis() / 100) % 2);  // Fast blink
    }
    if (millis() - pressStart >= 5000) {
      factoryReset();
    }
  }
  
  // Try to connect if we have WiFi config
  if (isConfigured()) {
    Serial.printf("Found WiFi config: SSID=%s\n", config.ssid);
    if (connectToWiFi()) {
      Serial.println("✓ Connected to WiFi!");
      Serial.printf("  IP Address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("  MAC Address: %s\n", WiFi.macAddress().c_str());
      Serial.printf("  Signal: %d dBm\n", WiFi.RSSI());
      digitalWrite(LED_PIN, HIGH);  // Solid = connected
      
      // Register device if no token
      if (strlen(config.apiToken) == 0) {
        Serial.println("\nNo API token found. Registering device...");
        if (registerDevice()) {
          Serial.println("✓ Device registered successfully!");
        } else {
          Serial.println("⚠ Device registration failed. Will retry later.");
        }
      } else {
        Serial.printf("✓ Using existing API token: %.10s...\n", config.apiToken);
      }
      
      // Update device status
      updateDeviceStatus();
      
      Serial.println("\n✓ Setup complete! Sending data every 30 seconds.");
      return;  // Exit setup, go to loop
    } else {
      Serial.println("✗ Failed to connect to saved WiFi");
    }
  } else {
    Serial.println("No WiFi configuration found");
  }
  
  // Start AP mode for configuration
  Serial.println("Starting setup mode...");
  startAPMode();
}

void loop() {
  if (WiFi.getMode() == WIFI_AP) {
    // Setup mode - handle web server
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Blink LED in setup mode
    digitalWrite(LED_PIN, (millis() / 500) % 2);
    
  } else if (WiFi.status() == WL_CONNECTED) {
    // Connected mode - send data
    
    // Send sensor data every 30 seconds
    if (millis() - lastDataSend >= DATA_SEND_INTERVAL) {
      if (sendSensorData()) {
        Serial.println("✓ Data sent successfully");
        // Quick flash to indicate success
        digitalWrite(LED_PIN, LOW);
        delay(50);
        digitalWrite(LED_PIN, HIGH);
      } else {
        Serial.println("✗ Failed to send data");
      }
      lastDataSend = millis();
    }
    
    // Update device status every 5 minutes
    if (millis() - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
      updateDeviceStatus();
      lastStatusUpdate = millis();
    }
    
  } else {
    // Lost connection - try to reconnect
    Serial.println("WiFi disconnected! Attempting to reconnect...");
    digitalWrite(LED_PIN, LOW);
    if (connectToWiFi()) {
      Serial.println("✓ Reconnected to WiFi");
      digitalWrite(LED_PIN, HIGH);
    } else {
      Serial.println("✗ Reconnection failed. Restarting...");
      delay(5000);
      ESP.restart();
    }
  }
  
  // Handle factory reset button
  static unsigned long buttonPressTime = 0;
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (buttonPressTime == 0) {
      buttonPressTime = millis();
    } else if (millis() - buttonPressTime > 5000) {
      factoryReset();
    }
  } else {
    buttonPressTime = 0;
  }
}

void startAPMode() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP("SmartFilter_Setup");
  
  IPAddress IP = WiFi.softAPIP();
  Serial.println("\n========================================");
  Serial.println("Setup Mode Active!");
  Serial.println("========================================");
  Serial.println("1. Connect to WiFi: SmartFilter_Setup");
  Serial.printf("2. Open browser: http://%s\n", IP.toString().c_str());
  Serial.println("3. Enter your WiFi credentials");
  Serial.println("========================================\n");
  
  // Setup DNS to redirect all to our IP
  dnsServer.start(DNS_PORT, "*", IP);
  
  // Setup web server
  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);
  
  server.begin();
}

void handleRoot() {
  String html = String(setupHTML);
  html.replace("%DEVICE_ID%", config.deviceId);
  server.send(200, "text/html", html);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  
  Serial.printf("\nReceived config: SSID=%s\n", ssid.c_str());
  
  // Save to config
  strcpy(config.magic, "WIFI");
  ssid.toCharArray(config.ssid, sizeof(config.ssid));
  password.toCharArray(config.password, sizeof(config.password));
  
  // Clear any old token when setting up new WiFi
  memset(config.apiToken, 0, sizeof(config.apiToken));
  
  // Save to EEPROM
  saveConfig();
  
  // Send response
  String html = "<html><body style='font-family: Arial; padding: 20px;'>";
  html += "<h2>✓ Configuration Saved!</h2>";
  html += "<p>Device ID: <strong>" + String(config.deviceId) + "</strong></p>";
  html += "<p>The device will restart and connect to: <strong>" + ssid + "</strong></p>";
  html += "<p>After connecting, visit your dashboard to link this device.</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
  
  delay(3000);
  ESP.restart();
}

bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  
  Serial.printf("Connecting to %s", config.ssid);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  return (WiFi.status() == WL_CONNECTED);
}

void generateDeviceId() {
  const char chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  // Use MAC address for randomness
  uint8_t mac[6];
  WiFi.macAddress(mac);
  randomSeed(mac[5] + (mac[4] << 8) + (mac[3] << 16));
  
  strcpy(config.deviceId, "SF");
  for (int i = 2; i < 16; i++) {
    config.deviceId[i] = chars[random(0, 36)];
  }
  config.deviceId[16] = '\0';
  
  Serial.printf("Generated Device ID: %s\n", config.deviceId);
}

bool registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/device/register";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = config.deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = "1.0.0";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("Registering device: %s\n", config.deviceId);
  Serial.printf("POST %s\n", url.c_str());
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    String response = http.getString();
    
    // Parse response
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["success"] && responseDoc["token"]) {
      String token = responseDoc["token"].as<String>();
      token.toCharArray(config.apiToken, sizeof(config.apiToken));
      saveConfig();
      Serial.printf("✓ Received token: %.20s...\n", config.apiToken);
      http.end();
      return true;
    }
  } else {
    Serial.printf("✗ Registration failed. HTTP code: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.printf("Response: %s\n", http.getString().c_str());
    }
  }
  
  http.end();
  return false;
}

bool sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  // Register if we don't have a token
  if (strlen(config.apiToken) == 0) {
    Serial.println("No token, attempting registration...");
    if (!registerDevice()) {
      return false;
    }
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/sensor";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  // Generate test sensor data (replace with real sensor later)
  float pressure = 10.0 + (random(-50, 50) / 10.0);
  float temperature = 22.0 + (random(-30, 30) / 10.0);
  
  StaticJsonDocument<128> doc;
  doc["pressure"] = pressure;
  doc["temperature"] = temperature;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("[%lu s] Sending: P=%.1f Pa, T=%.1f°C", 
                millis()/1000, pressure, temperature);
  
  int httpCode = http.POST(jsonString);
  bool success = (httpCode == 200);
  
  if (success) {
    Serial.println(" ✓");
  } else {
    Serial.printf(" ✗ (HTTP %d)\n", httpCode);
    
    // If unauthorized, clear token to force re-registration
    if (httpCode == 401) {
      Serial.println("Token invalid, clearing for re-registration");
      memset(config.apiToken, 0, sizeof(config.apiToken));
      saveConfig();
    }
  }
  
  http.end();
  return success;
}

bool updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || strlen(config.apiToken) == 0) return false;
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/device/status";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  StaticJsonDocument<256> doc;
  doc["status"] = "active";
  doc["firmware"] = "1.0.0";
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  doc["uptime"] = millis() / 1000;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.PUT(jsonString);
  
  if (httpCode == 200) {
    Serial.println("✓ Status updated");
  } else {
    Serial.printf("✗ Status update failed (HTTP %d)\n", httpCode);
  }
  
  http.end();
  return (httpCode == 200);
}

void loadConfig() {
  EEPROM.get(0, config);
  if (strcmp(config.magic, "WIFI") != 0) {
    Serial.println("No valid config in EEPROM");
    memset(&config, 0, sizeof(config));
  }
}

void saveConfig() {
  EEPROM.put(0, config);
  if (EEPROM.commit()) {
    Serial.println("✓ Configuration saved");
  } else {
    Serial.println("✗ Failed to save configuration!");
  }
}

bool isConfigured() {
  return strcmp(config.magic, "WIFI") == 0 && strlen(config.ssid) > 0;
}

void factoryReset() {
  Serial.println("\n!!! FACTORY RESET !!!");
  
  // Flash LED rapidly
  for(int i = 0; i < 20; i++) {
    digitalWrite(LED_PIN, i % 2);
    delay(50);
  }
  
  // Clear configuration
  memset(&config, 0, sizeof(config));
  EEPROM.put(0, config);
  EEPROM.commit();
  
  Serial.println("Configuration cleared!");
  delay(1000);
  ESP.restart();
}
