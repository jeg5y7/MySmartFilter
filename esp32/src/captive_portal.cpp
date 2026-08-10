#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <Wire.h>
#include <time.h>
#include "ca_bundle.h"

// Firmware version — overridden by FIRMWARE_VERSION build flag in platformio.ini
#ifndef FIRMWARE_VERSION
  #define FIRMWARE_VERSION "1.0.0"
#endif

// EEPROM storage structure
struct Config {
  char magic[4];  // "SF02" to verify valid config (SF02 added deviceSecret)
  char ssid[33];
  char password[64];
  char deviceId[17];  // 16 chars + null terminator
  char apiToken[65];  // 64 chars + null terminator
  char deviceSecret[65];  // self-generated, proves ownership on re-register
  bool configured;
};

// Configuration constants
const char* AP_SSID = "SmartFilter_Setup";
const char* AP_PASSWORD = "";  // Open network for easy access
#ifndef API_BASE_URL
  #define API_BASE_URL "https://mysmartfilter.com/api"
#endif
const char* API_BASE_URL_STR = API_BASE_URL;
const byte DNS_PORT = 53;
const int CONFIG_VERSION = 1;

// Hardware configuration
#define SDP810_I2C_ADDRESS 0x25
#define LED_PIN 2  // Built-in LED for status

// Global objects
WebServer server(80);
DNSServer dnsServer;
Config config;
WiFiClientSecure apiClient;  // TLS with pinned root CAs for all API calls
bool wifiConnected = false;
unsigned long lastReading = 0;
const unsigned long readingInterval = 30000;  // 30 seconds

// Sensor data structure
struct SensorData {
  float pressure;
  float temperature;
  bool valid;
};

// HTML for captive portal
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Smart Filter Setup</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .status {
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px;
            margin: 8px 0;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        input:focus {
            outline: none;
            border-color: #3b82f6;
        }
        label {
            display: block;
            margin-top: 15px;
            color: #374151;
            font-weight: 500;
            font-size: 14px;
        }
        button {
            width: 100%;
            padding: 14px;
            margin-top: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .device-id {
            background: #f3f4f6;
            padding: 10px;
            border-radius: 6px;
            font-family: monospace;
            margin: 10px 0;
            word-break: break-all;
        }
        .step {
            background: #fef3c7;
            border: 1px solid #fbbf24;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .spinner {
            display: none;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #ef4444;
            font-size: 14px;
            margin-top: 5px;
        }
        .success {
            color: #10b981;
            font-size: 14px;
            margin-top: 5px;
        }
        #networks {
            margin: 10px 0;
        }
        .network-item {
            padding: 10px;
            margin: 5px 0;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .network-item:hover {
            border-color: #3b82f6;
            background: #f0f9ff;
        }
        .signal-strength {
            float: right;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Smart Filter Setup</h1>
        <p class="subtitle">Connect your filter monitor to WiFi</p>
        
        <div class="status">
            <strong>Device ID:</strong>
            <div class="device-id" id="deviceId">Generating...</div>
        </div>

        <form id="setupForm">
            <label>WiFi Network</label>
            <div id="networks">
                <div style="text-align: center; padding: 20px;">
                    <div class="spinner" style="display: block;"></div>
                    <p>Scanning for networks...</p>
                </div>
            </div>
            <input type="text" id="ssid" name="ssid" placeholder="Or enter network name manually" required>
            
            <label>WiFi Password</label>
            <input type="password" id="password" name="password" placeholder="Enter WiFi password" required>
            
            <div class="step">
                <strong>Next Step:</strong> After connecting to WiFi, you'll be redirected to mysmartfilter.com to complete setup and link this device to your account.
            </div>
            
            <button type="submit" id="submitBtn">Connect to WiFi</button>
            <div id="message"></div>
        </form>
    </div>

    <script>
        // The device ID is owned by the firmware (derived from the chip's
        // factory MAC) — fetch it so the label QR and the account link match
        let deviceId = '';
        fetch('/deviceinfo')
            .then(r => r.json())
            .then(d => {
                deviceId = d.deviceId;
                document.getElementById('deviceId').textContent = deviceId;
            })
            .catch(() => {
                document.getElementById('deviceId').textContent = 'unavailable';
            });

        // Scan for WiFi networks
        function scanNetworks() {
            fetch('/scan')
                .then(response => response.json())
                .then(data => {
                    const networksDiv = document.getElementById('networks');
                    if (data.networks && data.networks.length > 0) {
                        networksDiv.innerHTML = '<p style="margin: 5px 0; color: #666;">Available networks (click to select):</p>';
                        data.networks.forEach(network => {
                            const div = document.createElement('div');
                            div.className = 'network-item';
                            div.innerHTML = `
                                <strong>${network.ssid}</strong>
                                <span class="signal-strength">${network.rssi} dBm</span>
                            `;
                            div.onclick = () => {
                                document.getElementById('ssid').value = network.ssid;
                                // Highlight selected
                                document.querySelectorAll('.network-item').forEach(item => {
                                    item.style.borderColor = '#e5e7eb';
                                });
                                div.style.borderColor = '#3b82f6';
                            };
                            networksDiv.appendChild(div);
                        });
                    } else {
                        networksDiv.innerHTML = '<p style="color: #666;">No networks found. Enter manually.</p>';
                    }
                })
                .catch(error => {
                    console.error('Error scanning:', error);
                    document.getElementById('networks').innerHTML = '<p style="color: #ef4444;">Failed to scan networks</p>';
                });
        }

        // Scan on load
        setTimeout(scanNetworks, 1000);

        // Handle form submission
        document.getElementById('setupForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('submitBtn');
            const msg = document.getElementById('message');
            
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            msg.innerHTML = '<div class="spinner" style="display: block;"></div>';
            
            const formData = new FormData();
            formData.append('ssid', document.getElementById('ssid').value);
            formData.append('password', document.getElementById('password').value);
            formData.append('deviceId', deviceId);
            
            fetch('/configure', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    msg.innerHTML = '<p class="success">✓ Connected! Redirecting to complete setup...</p>';
                    // Store device ID for the redirect
                    setTimeout(() => {
                        window.location.href = `https://mysmartfilter.com/setup/device?id=${deviceId}`;
                    }, 3000);
                } else {
                    msg.innerHTML = `<p class="error">✗ ${data.message || 'Connection failed. Please try again.'}</p>`;
                    btn.disabled = false;
                    btn.textContent = 'Connect to WiFi';
                }
            })
            .catch(error => {
                msg.innerHTML = '<p class="error">✗ An error occurred. Please try again.</p>';
                btn.disabled = false;
                btn.textContent = 'Connect to WiFi';
            });
        });
    </script>
</body>
</html>
)rawliteral";

// Forward declarations
void ensureDeviceId();
void syncClock();
void startSetupMode();
void handleRoot();
void handleScan();
void handleConfigure();
void checkOTAUpdate();
void startNormalOperation();
bool connectToWiFi();
void registerDevice();
void updateDeviceStatus();
bool sendSensorData(SensorData data);
void initializeSDP810();
SensorData readSDP810();
void loadConfig();
void ensureDeviceSecret();
void saveConfig();
void clearConfig();
bool isConfigured();
void factoryReset();

void setup() {
  Serial.begin(115200);
  Serial.println("\n\nSmart Filter WiFi Manager Starting...");
  
  // Initialize EEPROM
  EEPROM.begin(sizeof(Config));
  loadConfig();
  ensureDeviceId();

  // TLS: only trust our pinned root CAs for API calls
  apiClient.setCACert(CA_BUNDLE);

  // Initialize I2C for sensor
  Wire.begin(21, 22);
  
  // Setup LED for status indication
  pinMode(LED_PIN, OUTPUT);
  
  // Check if already configured
  if (isConfigured()) {
    Serial.println("Configuration found. Connecting to WiFi...");
    if (connectToWiFi()) {
      Serial.println("Connected to WiFi. Starting normal operation.");
      initializeSDP810();
      startNormalOperation();
    } else {
      Serial.println("Failed to connect to WiFi. Starting setup mode...");
      startSetupMode();
    }
  } else {
    Serial.println("No configuration found. Starting setup mode...");
    startSetupMode();
  }
}

void loop() {
  if (WiFi.getMode() == WIFI_AP) {
    // Handle DNS and web server in AP mode
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Blink LED to indicate setup mode
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else if (wifiConnected) {
    // Normal operation - read sensor and send data
    if (millis() - lastReading >= readingInterval) {
      SensorData data = readSDP810();
      
      if (data.valid) {
        Serial.printf("Pressure: %.2f Pa, Temperature: %.2f °C\n", 
                      data.pressure, data.temperature);
        
        if (sendSensorData(data)) {
          Serial.println("✓ Data sent successfully");
          // Solid LED for successful operation
          digitalWrite(LED_PIN, HIGH);
        } else {
          Serial.println("✗ Failed to send data");
          // Flash LED for error
          for(int i = 0; i < 3; i++) {
            digitalWrite(LED_PIN, LOW);
            delay(100);
            digitalWrite(LED_PIN, HIGH);
            delay(100);
          }
        }
      }
      
      lastReading = millis();
    }
    
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      wifiConnected = connectToWiFi();
    }
  }
}

void startSetupMode() {
  // Create AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  // Setup DNS server to redirect all requests to our captive portal
  dnsServer.start(DNS_PORT, "*", IP);
  
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/scan", handleScan);
  server.on("/configure", HTTP_POST, handleConfigure);
  server.on("/deviceinfo", []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json",
                String("{\"deviceId\":\"") + config.deviceId + "\"}");
  });
  server.onNotFound(handleRoot);  // Redirect all 404 to root
  
  server.begin();
  Serial.println("Setup server started");
  Serial.println("Connect to WiFi network: " + String(AP_SSID));
  Serial.println("Open browser to: http://192.168.4.1");
}

void handleRoot() {
  server.send(200, "text/html", SETUP_HTML);
}

void handleScan() {
  String json = "{\"networks\":[";
  int n = WiFi.scanNetworks();
  
  if (n > 0) {
    for (int i = 0; i < n; i++) {
      if (i > 0) json += ",";
      json += "{";
      json += "\"ssid\":\"" + WiFi.SSID(i) + "\",";
      json += "\"rssi\":" + String(WiFi.RSSI(i)) + ",";
      json += "\"encrypted\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
      json += "}";
    }
  }
  json += "]}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void handleConfigure() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");

  Serial.println("Received configuration:");
  Serial.println("SSID: " + ssid);
  Serial.println("Device ID: " + String(config.deviceId));

  // Save configuration — deviceId is firmware-owned (MAC-derived), never
  // taken from the client
  ssid.toCharArray(config.ssid, sizeof(config.ssid));
  password.toCharArray(config.password, sizeof(config.password));
  strcpy(config.magic, "SF02");
  config.configured = true;
  
  saveConfig();
  
  // Try to connect
  WiFi.begin(ssid.c_str(), password.c_str());
  
  // Wait for connection (max 10 seconds)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Connected to WiFi!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Send success response
    String response = "{\"success\":true,\"ip\":\"" + WiFi.localIP().toString() + "\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    // Restart to begin normal operation
    delay(2000);
    ESP.restart();
  } else {
    // Connection failed
    Serial.println("Failed to connect to WiFi");
    String response = "{\"success\":false,\"message\":\"Failed to connect to WiFi. Check password.\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    // Clear the failed configuration
    clearConfig();
  }
}

/**
 * checkOTAUpdate()
 *
 * Calls /api/ota/check with the current firmware version.
 * If the server reports a newer version, downloads and flashes the binary
 * using the ESP32 HTTPUpdate library, then reboots.
 *
 * This runs once on boot, after WiFi connects.
 */
void checkOTAUpdate() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (strlen(config.apiToken) == 0) {
    Serial.println("[OTA] No API token — skipping OTA check");
    return;
  }

  Serial.printf("[OTA] Checking for update (current: %s)...\n", FIRMWARE_VERSION);

  HTTPClient http;
  String url = String(API_BASE_URL_STR) + "/ota/check?version=" + FIRMWARE_VERSION;

  http.begin(apiClient, url);
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));

  int httpCode = http.GET();

  if (httpCode != 200) {
    Serial.printf("[OTA] Check failed — HTTP %d\n", httpCode);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("[OTA] Failed to parse OTA check response");
    return;
  }

  bool hasUpdate = doc["hasUpdate"] | false;
  if (!hasUpdate) {
    Serial.println("[OTA] Firmware is up to date");
    return;
  }

  String newVersion = doc["version"].as<String>();
  String binaryUrl  = doc["binaryUrl"].as<String>();
  Serial.printf("[OTA] Update available: %s -> %s\n", FIRMWARE_VERSION, newVersion.c_str());
  Serial.printf("[OTA] Downloading from: %s\n", binaryUrl.c_str());

  // Validate the OTA download against the same pinned roots as API calls —
  // an unauthenticated firmware swap is the worst-case compromise
  WiFiClientSecure client;
  client.setCACert(CA_BUNDLE);

  // Progress callback
  httpUpdate.onProgress([](int cur, int total) {
    Serial.printf("[OTA] Progress: %d / %d bytes (%.0f%%)\r",
                  cur, total, total > 0 ? (100.0f * cur / total) : 0.0f);
  });

  t_httpUpdate_return ret = httpUpdate.update(client, binaryUrl);

  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[OTA] Update FAILED — error %d: %s\n",
                    httpUpdate.getLastError(),
                    httpUpdate.getLastErrorString().c_str());
      break;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[OTA] Server says no update needed (unexpected)");
      break;
    case HTTP_UPDATE_OK:
      // HTTPUpdate calls ESP.restart() automatically after flashing,
      // but be explicit just in case.
      Serial.println("[OTA] Update OK — restarting...");
      delay(500);
      ESP.restart();
      break;
  }
}

void startNormalOperation() {
  wifiConnected = true;
  // Register device with backend (obtains/refreshes API token)
  registerDevice();
  // Check for OTA firmware update on every boot
  checkOTAUpdate();
}

bool connectToWiFi() {
  if (strlen(config.ssid) == 0) {
    return false;
  }
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    syncClock();  // TLS cert validation needs a correct clock
    return true;
  }

  Serial.println("\nFailed to connect to WiFi");
  return false;
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  Serial.println("Registering device with backend...");
  
  HTTPClient http;
  String url = String(API_BASE_URL_STR) + "/device/register";
  
  http.begin(apiClient, url);
  http.addHeader("Content-Type", "application/json");
  
  ensureDeviceSecret();

  DynamicJsonDocument doc(384);
  doc["deviceId"] = config.deviceId;
  doc["deviceSecret"] = config.deviceSecret;
  doc["type"] = "SmartFilter";
  doc["firmware"] = FIRMWARE_VERSION;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Registering with deviceId: " + String(config.deviceId));
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Registration response: " + response);
    
    DynamicJsonDocument responseDoc(512);
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (error) {
      Serial.println("Failed to parse registration response");
    } else if (responseDoc.containsKey("token")) {
      String token = responseDoc["token"].as<String>();
      token.toCharArray(config.apiToken, sizeof(config.apiToken));
      saveConfig();
      Serial.println("Device registered successfully with token: " + token.substring(0, 10) + "...");
      
      // Update device status to show it's online
      updateDeviceStatus();
    }
  } else {
    Serial.printf("Failed to register device. HTTP code: %d\n", httpResponseCode);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Error response: " + response);
    }
  }
  
  http.end();
}

void updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || strlen(config.apiToken) == 0) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL_STR) + "/device/status";
  
  http.begin(apiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  DynamicJsonDocument doc(256);
  doc["status"] = "active";
  doc["firmware"] = FIRMWARE_VERSION;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.PUT(jsonString);
  
  if (httpResponseCode == 200) {
    Serial.println("Device status updated");
  } else {
    Serial.printf("Failed to update device status. HTTP code: %d\n", httpResponseCode);
  }
  
  http.end();
}

bool sendSensorData(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  // Check if we have an API token
  if (strlen(config.apiToken) == 0) {
    Serial.println("No API token available. Attempting to register device...");
    registerDevice();
    if (strlen(config.apiToken) == 0) {
      Serial.println("Failed to obtain API token");
      return false;
    }
  }
  
  HTTPClient http;
  String url = String(API_BASE_URL_STR) + "/sensor";
  
  http.begin(apiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  DynamicJsonDocument doc(256);
  doc["pressure"] = data.pressure;
  doc["temperature"] = data.temperature;
  // deviceId is now inferred from the token, no need to send it
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending data: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  bool success = (httpResponseCode == 200);
  
  if (!success) {
    Serial.printf("Failed to send data. HTTP code: %d\n", httpResponseCode);
    if (httpResponseCode == 401) {
      Serial.println("Authentication failed. Token may be invalid.");
      // Clear token to force re-registration on next attempt
      memset(config.apiToken, 0, sizeof(config.apiToken));
      saveConfig();
    }
  }
  
  http.end();
  return success;
}

void initializeSDP810() {
  Wire.beginTransmission(SDP810_I2C_ADDRESS);
  Wire.write(0x36);
  Wire.write(0x03);
  int error = Wire.endTransmission();
  
  if (error == 0) {
    Serial.println("SDP810 sensor initialized successfully");
  } else {
    Serial.println("Failed to initialize SDP810 sensor");
  }
  
  delay(100);
}

SensorData readSDP810() {
  SensorData data = {0, 0, false};

#ifdef SKIP_SENSOR
  // Bench-test mode: plausible fake data (blower cycles ~15 min on/off)
  bool blowerOn = (millis() / 900000UL) % 2 == 0;
  float noise = (esp_random() % 100) / 50.0 - 1.0;
  data.pressure = blowerOn ? 38.0 + noise * 2.5 : 0.4 + noise * 0.3;
  data.temperature = 21.0 + noise;
  data.valid = true;
  return data;
#endif

  Wire.requestFrom(SDP810_I2C_ADDRESS, 9);
  
  if (Wire.available() >= 9) {
    int16_t pressureRaw = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC
    
    int16_t temperatureRaw = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC
    
    // Skip scale factor bytes
    Wire.read(); Wire.read(); Wire.read();
    
    data.pressure = pressureRaw / 60.0;
    data.temperature = temperatureRaw / 200.0;
    data.valid = true;
    
    // Sanity check
    if (data.temperature < -40 || data.temperature > 85) {
      data.valid = false;
    }
  }
  
  return data;
}

void loadConfig() {
  EEPROM.get(0, config);

  // Check if config is valid (SF01 layouts lack the secret — start fresh)
  if (strcmp(config.magic, "SF02") != 0) {
    clearConfig();
    strncpy(config.magic, "SF02", sizeof(config.magic));
  }
}

// Stable device ID derived from the chip's factory MAC address: the same
// board always produces the same ID, so a QR label printed at flash time
// stays correct for the life of the unit.
void ensureDeviceId() {
  if (config.deviceId[0] != '\0') return;
  uint64_t mac = ESP.getEfuseMac();
  snprintf(config.deviceId, sizeof(config.deviceId), "SF%012llX",
           (unsigned long long)(mac & 0xFFFFFFFFFFFFULL));
  saveConfig();
  Serial.println("Device ID: " + String(config.deviceId));
}

// TLS certificate validation needs a correct clock — sync via NTP once
// after WiFi connects (fast; retries are cheap).
void syncClock() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print("Syncing clock");
  time_t now = time(nullptr);
  int tries = 0;
  while (now < 1700000000 && tries < 30) {  // wait for a sane date
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    tries++;
  }
  Serial.println(now >= 1700000000 ? " done" : " FAILED (TLS may not work)");
}

// Generate the device secret from the hardware RNG on first use.
// The server stores only a hash; presenting the same secret later is how
// this device re-fetches its API token after a wipe or WiFi change.
void ensureDeviceSecret() {
  if (config.deviceSecret[0] != '\0') return;
  const char* hex = "0123456789abcdef";
  for (int i = 0; i < 64; i++) {
    config.deviceSecret[i] = hex[esp_random() & 0x0F];
  }
  config.deviceSecret[64] = '\0';
  saveConfig();
  Serial.println("Generated device secret");
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

// Factory reset function (call from serial monitor or button press)
void factoryReset() {
  Serial.println("Performing factory reset...");
  clearConfig();
  ESP.restart();
}
