/**
 * Smart Filter ESP32 - WiFiManager Version
 * Creates a captive portal for WiFi configuration
 * 
 * On first boot or if WiFi fails:
 * 1. Creates access point "SmartFilter_Setup" 
 * 2. Opens captive portal at 192.168.4.1
 * 3. User enters WiFi credentials
 * 4. Device saves config and restarts
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <EEPROM.h>

// Configuration structure
struct Config {
  char magic[5];         // "SF01" + null terminator to verify valid config
  char ssid[33];         // WiFi SSID
  char password[64];     // WiFi password
  char deviceId[17];     // Device unique ID
  char apiToken[65];     // API authentication token
  bool configured;       // Configuration valid flag
};

// Sensor data structure
struct SensorData {
  float pressure;
  float temperature;
  bool valid;
};

// Hardware configuration
#define SDP810_I2C_ADDRESS 0x25
#define LED_PIN 2
#define BUTTON_PIN 0  // BOOT button for factory reset

// Access Point configuration
const char* AP_SSID = "SmartFilter_Setup";
const char* AP_PASSWORD = "";  // Open network
const byte DNS_PORT = 53;

// API configuration
#ifndef API_URL
  #define API_URL "https://mysmartfilter.com/api"
#endif

// Global variables
Config config;
WebServer server(80);
DNSServer dnsServer;
bool wifiConnected = false;
unsigned long lastReading = 0;
unsigned long lastStatusUpdate = 0;
const unsigned long readingInterval = 30000; // 30 seconds
const unsigned long statusInterval = 300000; // 5 minutes

// Function declarations
void loadConfig();
void saveConfig();
void clearConfig();
bool isConfigured();
void factoryReset();
bool connectToWiFi();
void startSetupMode();
void startNormalOperation();
void handleRoot();
void handleScan();
void handleConfigure();
void registerDevice();
void updateDeviceStatus();
bool sendSensorData(const SensorData& data);
void initializeSDP810();
SensorData readSDP810();
SensorData generateTestData();

// HTML for setup page
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Smart Filter Setup</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 400px;
            width: 100%;
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
        }
        h1 {
            color: #1a202c;
            font-size: 24px;
            margin-bottom: 10px;
            text-align: center;
        }
        .subtitle {
            color: #718096;
            text-align: center;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .device-info {
            background: #f7fafc;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 25px;
            font-size: 12px;
            color: #4a5568;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #4a5568;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
        }
        input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 14px;
            transition: all 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        #networks {
            max-height: 200px;
            overflow-y: auto;
            margin-bottom: 20px;
        }
        .network-item {
            padding: 12px;
            margin: 5px 0;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .network-item:hover {
            border-color: #667eea;
            background: #f7fafc;
        }
        .signal-strength {
            font-size: 12px;
            color: #718096;
        }
        #message {
            margin-top: 20px;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
        }
        .success {
            background: #c6f6d5;
            color: #22543d;
            border: 1px solid #9ae6b4;
        }
        .error {
            background: #fed7d7;
            color: #742a2a;
            border: 1px solid #fc8181;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-icon">🔧</div>
            <h1>Smart Filter Setup</h1>
            <p class="subtitle">Connect your filter monitor to WiFi</p>
        </div>
        
        <div class="device-info">
            <strong>Device ID:</strong> <span id="deviceId">Loading...</span>
        </div>
        
        <div id="networks">
            <p style="color: #718096; text-align: center;">Scanning for networks...</p>
        </div>
        
        <form id="setupForm">
            <div class="form-group">
                <label for="ssid">WiFi Network (SSID)</label>
                <input type="text" id="ssid" name="ssid" required placeholder="Enter or select network">
            </div>
            
            <div class="form-group">
                <label for="password">WiFi Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password">
            </div>
            
            <button type="submit" id="submitBtn">Connect to WiFi</button>
        </form>
        
        <div id="message"></div>
    </div>
    
    <script>
        // Generate a unique device ID
        function generateDeviceId() {
            const mac = Math.random().toString(36).substring(2, 10).toUpperCase();
            const deviceId = 'SF_' + mac;
            return deviceId;
        }

        // Display device ID
        const deviceId = generateDeviceId();
        document.getElementById('deviceId').textContent = deviceId;

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
                                    item.style.borderColor = '#e2e8f0';
                                });
                                div.style.borderColor = '#667eea';
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
            msg.innerHTML = '<div class="spinner"></div>';
            
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
                    msg.innerHTML = '<p class="success">✓ Connected! Device will restart...</p>';
                    setTimeout(() => {
                        msg.innerHTML += '<p style="margin-top:10px">You can close this page.</p>';
                    }, 2000);
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

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n================================");
  Serial.println("Smart Filter WiFi Manager");
  Serial.println("================================");
  
  // Setup hardware
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize EEPROM with proper size
  if (!EEPROM.begin(512)) {  // Use fixed size larger than Config struct
    Serial.println("ERROR: Failed to initialize EEPROM!");
  }
  loadConfig();
  
  // Initialize I2C for sensor
  Wire.begin(21, 22);
  
  // Check if already configured
  if (isConfigured()) {
    Serial.println("Configuration found. Connecting to WiFi...");
    if (connectToWiFi()) {
      Serial.println("Connected! Starting normal operation.");
      startNormalOperation();
    } else {
      Serial.println("Failed to connect. Starting setup mode...");
      startSetupMode();
    }
  } else {
    Serial.println("No configuration found. Starting setup mode...");
    startSetupMode();
  }
}

void loop() {
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
  
  // Handle different modes
  if (WiFi.getMode() == WIFI_AP) {
    // Setup mode - handle DNS and web server
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Blink LED to indicate setup mode
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else if (wifiConnected) {
    // Normal operation - read and send sensor data
    if (millis() - lastReading >= readingInterval) {
      SensorData data;
      
      #ifdef USE_TEST_DATA
        data = generateTestData();
      #else
        data = readSDP810();
      #endif
      
      if (data.valid) {
        Serial.printf("Pressure: %.2f Pa, Temperature: %.2f °C\n", 
                      data.pressure, data.temperature);
        
        if (sendSensorData(data)) {
          Serial.println("✓ Data sent successfully");
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
    
    // Update device status periodically
    if (millis() - lastStatusUpdate >= statusInterval) {
      updateDeviceStatus();
      lastStatusUpdate = millis();
    }
    
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      wifiConnected = connectToWiFi();
      if (!wifiConnected) {
        // If reconnection fails, restart to go back to setup mode
        delay(5000);
        ESP.restart();
      }
    }
  }
}

void startSetupMode() {
  // Create Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  // Setup DNS server for captive portal
  dnsServer.start(DNS_PORT, "*", IP);
  
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/scan", handleScan);
  server.on("/configure", HTTP_POST, handleConfigure);
  server.onNotFound(handleRoot);  // Redirect all 404 to root
  
  server.begin();
  Serial.println("\n=== Setup Mode Active ===");
  Serial.println("1. Connect to WiFi: " + String(AP_SSID));
  Serial.println("2. Open browser to: http://192.168.4.1");
  Serial.println("3. Or wait for captive portal to appear");
  Serial.println("========================\n");
}

void startNormalOperation() {
  wifiConnected = true;
  
  // Initialize sensor
  initializeSDP810();
  
  // Register device if no token
  if (strlen(config.apiToken) == 0) {
    registerDevice();
  }
  
  // Update initial status
  updateDeviceStatus();
  
  Serial.println("\n=== Normal Operation Started ===");
  Serial.println("Sending data every 30 seconds");
  Serial.println("===============================\n");
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
  String deviceId = server.arg("deviceId");
  
  Serial.println("\n================================");
  Serial.println("Received configuration:");
  Serial.println("SSID: " + ssid);
  Serial.println("Device ID: " + deviceId);
  Serial.println("================================\n");
  
  // First, test the connection before saving
  Serial.println("Testing WiFi connection...");
  
  // Switch to STA mode to test the connection
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  
  // Wait for connection (max 15 seconds)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✓ WiFi connection successful!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // NOW save the configuration since we know it works
    ssid.toCharArray(config.ssid, sizeof(config.ssid));
    password.toCharArray(config.password, sizeof(config.password));
    deviceId.toCharArray(config.deviceId, sizeof(config.deviceId));
    strcpy(config.magic, "SF01");
    config.configured = true;
    saveConfig();
    
    Serial.println("✓ Configuration saved to EEPROM");
    
    // Switch back to AP mode to send response
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    delay(100);
    
    // Send success response
    String response = "{\"success\":true,\"message\":\"Connected! Device will restart in 3 seconds...\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    // Give time for response to be sent
    delay(500);
    
    // Stop the server and DNS
    server.stop();
    dnsServer.stop();
    
    Serial.println("\nRestarting device in 3 seconds...");
    delay(3000);
    
    // Restart to begin normal operation
    ESP.restart();
  } else {
    // Connection failed - go back to AP mode
    Serial.println("✗ Failed to connect to WiFi");
    
    // Switch back to AP mode
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    delay(100);
    
    // Send failure response
    String response = "{\"success\":false,\"message\":\"Failed to connect. Please check your password and try again.\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    // Don't save the failed configuration
    Serial.println("Configuration not saved due to connection failure");
  }
}

bool connectToWiFi() {
  if (strlen(config.ssid) == 0) {
    return false;
  }
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ Connected to WiFi");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    return true;
  }
  
  Serial.println("\n✗ Failed to connect to WiFi");
  return false;
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  Serial.println("Registering device with backend...");
  
  HTTPClient http;
  String url = String(API_URL) + "/device/register";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = "2.0.0";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Registering with deviceId: " + String(config.deviceId));
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Registration response: " + response);
    
    JsonDocument responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["token"]) {
      String token = responseDoc["token"].as<String>();
      token.toCharArray(config.apiToken, sizeof(config.apiToken));
      saveConfig();
      Serial.println("✓ Device registered with token");
    }
  } else {
    Serial.printf("✗ Registration failed. HTTP code: %d\n", httpResponseCode);
  }
  
  http.end();
}

void updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || strlen(config.apiToken) == 0) return;
  
  HTTPClient http;
  String url = String(API_URL) + "/device/status";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  JsonDocument doc;
  doc["status"] = "active";
  doc["firmware"] = "2.0.0";
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.PUT(jsonString);
  
  if (httpResponseCode == 200) {
    Serial.println("✓ Device status updated");
  } else {
    Serial.printf("✗ Status update failed. HTTP code: %d\n", httpResponseCode);
  }
  
  http.end();
}

bool sendSensorData(const SensorData& data) {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  // Check if we have an API token
  if (strlen(config.apiToken) == 0) {
    Serial.println("No API token. Attempting to register...");
    registerDevice();
    if (strlen(config.apiToken) == 0) {
      return false;
    }
  }
  
  HTTPClient http;
  String url = String(API_URL) + "/sensor";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(config.apiToken));
  
  JsonDocument doc;
  doc["pressure"] = data.pressure;
  doc["temperature"] = data.temperature;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  bool success = (httpResponseCode == 200);
  
  if (!success) {
    Serial.printf("HTTP error code: %d\n", httpResponseCode);
    if (httpResponseCode == 401) {
      // Clear token to force re-registration
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
    Serial.println("✓ SDP810 sensor initialized");
  } else {
    Serial.println("✗ SDP810 sensor not found (error " + String(error) + ")");
  }
  
  delay(100);
}

SensorData readSDP810() {
  SensorData data = {0, 0, false};
  
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

SensorData generateTestData() {
  SensorData data;
  data.pressure = 10.0 + (random(-50, 50) / 10.0);
  data.temperature = 22.0 + (random(-30, 30) / 10.0);
  data.valid = true;
  return data;
}

void loadConfig() {
  EEPROM.get(0, config);
  
  // Check if config is valid
  if (strcmp(config.magic, "SF01") != 0) {
    clearConfig();
  }
}

void saveConfig() {
  EEPROM.put(0, config);
  if (EEPROM.commit()) {
    Serial.println("✓ Configuration committed to EEPROM");
    Serial.printf("  Saved: magic=%s, ssid=%s, configured=%d\n", 
                  config.magic, config.ssid, config.configured);
  } else {
    Serial.println("✗ ERROR: Failed to commit configuration to EEPROM!");
  }
}

void clearConfig() {
  memset(&config, 0, sizeof(config));
  saveConfig();
}

bool isConfigured() {
  return strcmp(config.magic, "SF01") == 0 && config.configured;
}

void factoryReset() {
  Serial.println("\n!!! FACTORY RESET !!!");
  
  // Flash LED rapidly
  for(int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    delay(50);
  }
  
  clearConfig();
  ESP.restart();
}
