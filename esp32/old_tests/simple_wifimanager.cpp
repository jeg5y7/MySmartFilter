/**
 * Simple WiFiManager for ESP32
 * A minimal, reliable implementation that properly saves WiFi credentials
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>

#define LED_PIN 2
#define BUTTON_PIN 0
#define EEPROM_SIZE 512

// Simple config structure
struct Config {
  char magic[5];      // "WIFI" + null
  char ssid[33];      
  char password[64];  
};

Config config;
WebServer server(80);
DNSServer dnsServer;
const byte DNS_PORT = 53;

// Forward declarations
void startAPMode();
void handleRoot();
void handleSave();
bool connectToWiFi();
void loadConfig();
void saveConfig();
bool isConfigured();
void factoryReset();

// Simple HTML page
const char* setupHTML = R"(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WiFi Setup</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    input { width: 100%; padding: 10px; margin: 10px 0; }
    button { width: 100%; padding: 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <h2>WiFi Setup</h2>
  <form action="/save" method="POST">
    <label>Network Name (SSID):</label>
    <input type="text" name="ssid" required>
    <label>Password:</label>
    <input type="password" name="password" required>
    <button type="submit">Save & Connect</button>
  </form>
</body>
</html>
)";

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n=== Simple WiFiManager ===");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  loadConfig();
  
  // Check for factory reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("Factory Reset!");
    factoryReset();
  }
  
  // Try to connect if we have config
  if (isConfigured()) {
    Serial.printf("Found config: SSID=%s\n", config.ssid);
    if (connectToWiFi()) {
      Serial.println("Connected to WiFi!");
      Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
      digitalWrite(LED_PIN, HIGH);  // Solid = connected
      return;  // Exit setup, go to loop
    } else {
      Serial.println("Failed to connect, starting AP mode");
    }
  } else {
    Serial.println("No config found, starting AP mode");
  }
  
  // Start AP mode for configuration
  startAPMode();
}

void loop() {
  if (WiFi.getMode() == WIFI_AP) {
    // Handle web server in AP mode
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Blink LED in setup mode
    digitalWrite(LED_PIN, (millis() / 500) % 2);
  } else {
    // Connected mode - just show status
    static unsigned long lastStatus = 0;
    if (millis() - lastStatus > 10000) {
      Serial.printf("Connected: IP=%s, RSSI=%d\n", 
                    WiFi.localIP().toString().c_str(), 
                    WiFi.RSSI());
      lastStatus = millis();
    }
  }
}

void startAPMode() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP("ESP32_Setup");
  
  IPAddress IP = WiFi.softAPIP();
  Serial.printf("AP Mode: Connect to 'ESP32_Setup'\n");
  Serial.printf("Setup URL: http://%s\n", IP.toString().c_str());
  
  // Setup DNS to redirect all to our IP
  dnsServer.start(DNS_PORT, "*", IP);
  
  // Setup web server
  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);
  
  server.begin();
}

void handleRoot() {
  server.send(200, "text/html", setupHTML);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  
  Serial.printf("\nReceived: SSID=%s, Pass=%s\n", ssid.c_str(), password.c_str());
  
  // Save to config
  strcpy(config.magic, "WIFI");
  ssid.toCharArray(config.ssid, sizeof(config.ssid));
  password.toCharArray(config.password, sizeof(config.password));
  
  // Save to EEPROM
  saveConfig();
  
  // Send response
  String html = "<html><body><h2>Saved!</h2>";
  html += "<p>SSID: " + ssid + "</p>";
  html += "<p>The device will restart and connect to your WiFi.</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
  
  delay(2000);
  ESP.restart();
}

bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  
  Serial.print("Connecting");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  return (WiFi.status() == WL_CONNECTED);
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
    Serial.println("Config saved to EEPROM!");
    Serial.printf("  Magic: %s\n", config.magic);
    Serial.printf("  SSID: %s\n", config.ssid);
  } else {
    Serial.println("ERROR: Failed to save config!");
  }
}

bool isConfigured() {
  return strcmp(config.magic, "WIFI") == 0 && strlen(config.ssid) > 0;
}

void factoryReset() {
  memset(&config, 0, sizeof(config));
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println("Factory reset complete!");
  ESP.restart();
}
