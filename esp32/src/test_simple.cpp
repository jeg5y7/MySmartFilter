/**
 * ESP32 Smart Filter - Simple Test Version
 * Edit the WiFi credentials below before uploading
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============= EDIT THESE BEFORE UPLOADING! =============
const char* WIFI_SSID = "BeMyPillow";          // <-- Your WiFi network name
const char* WIFI_PASSWORD = "4252417380";   // <-- Your WiFi password
// ========================================================

const char* SERVER_URL = "http://10.0.0.21:3000/api";
#define LED_PIN 2

String deviceId = "";
String apiToken = "";
unsigned long lastSend = 0;

// Function declarations
void registerDevice();
void sendData();

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n=== Smart Filter ESP32 Test ===");
  pinMode(LED_PIN, OUTPUT);
  
  // Generate device ID from MAC
  uint8_t mac[6];
  WiFi.macAddress(mac);
  deviceId = "SF";
  for (int i = 0; i < 6; i++) {
    char hex[3];
    sprintf(hex, "%02X", mac[i]);
    deviceId += hex;
  }
  Serial.print("Device ID: ");
  Serial.println(deviceId);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, (attempts % 2));
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
    
    // Register device
    registerDevice();
  } else {
    Serial.println("\n✗ Failed to connect!");
    Serial.println("Check your WiFi credentials");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastSend > 3000) {  // Every 3 seconds
      sendData();
      lastSend = millis();
    }
  } else {
    Serial.println("WiFi lost, reconnecting...");
    WiFi.reconnect();
    delay(5000);
  }
}

void registerDevice() {
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/device/register");
  http.addHeader("Content-Type", "application/json");
  
  JsonDocument doc;
  doc["deviceId"] = deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = "1.0.0-test";
  
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
      Serial.print("Token: ");
      Serial.println(apiToken.substring(0, 20) + "...");
    }
  } else {
    Serial.print("Failed: ");
    Serial.println(code);
  }
  http.end();
}

void sendData() {
  if (apiToken.length() == 0) {
    registerDevice();
    if (apiToken.length() == 0) return;
  }
  
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/sensor");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + apiToken);
  
  // Test data with variation
  float pressure = 10.0 + (random(-50, 50) / 10.0);
  float temperature = 22.0 + (random(-30, 30) / 10.0);
  
  JsonDocument doc;
  doc["pressure"] = pressure;
  doc["temperature"] = temperature;
  
  String json;
  serializeJson(doc, json);
  
  Serial.print("[");
  Serial.print(millis()/1000);
  Serial.print("s] P=");
  Serial.print(pressure);
  Serial.print(" T=");
  Serial.print(temperature);
  Serial.print(" ... ");
  
  int code = http.POST(json);
  
  if (code == 200) {
    Serial.println("✓");
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.print("✗ ");
    Serial.println(code);
    if (code == 403) {
      Serial.println("Device not linked - visit http://10.0.0.21:3000/devices");
    }
  }
  http.end();
}