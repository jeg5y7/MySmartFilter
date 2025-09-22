/**
 * Smart Filter ESP32 - WiFiManager Debug Version
 * Enhanced debugging for WiFi connection issues
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
  char magic[5];         // "SF01" + null terminator
  char ssid[33];         // WiFi SSID
  char password[64];     // WiFi password
  char deviceId[17];     // Device unique ID
  char apiToken[65];     // API authentication token
  bool configured;       // Configuration valid flag
};

// Hardware configuration
#define LED_PIN 2
#define BUTTON_PIN 0

// Access Point configuration
const char* AP_SSID = "SmartFilter_Setup";
const char* AP_PASSWORD = "";  // Open network
const byte DNS_PORT = 53;

// Global variables
Config config;
WebServer server(80);
DNSServer dnsServer;
bool wifiConnected = false;
String lastError = "";

// Function declarations
void loadConfig();
void saveConfig();
void clearConfig();
bool isConfigured();
void startSetupMode();
void handleRoot();
void handleScan();
void handleConfigure();
void handleStatus();

// Simple HTML for setup page
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Smart Filter Setup</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 50px auto;
            padding: 20px;
            background: #f0f0f0;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        input, select {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #45a049;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .network-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin: 10px 0;
        }
        .network-item {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        }
        .network-item:hover {
            background: #f5f5f5;
        }
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            text-align: center;
        }
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        #deviceInfo {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Smart Filter Setup</h1>
        
        <div id="deviceInfo">
            <strong>Device ID:</strong> <span id="deviceId">Generating...</span><br>
            <strong>Status:</strong> <span id="status">Ready</span>
        </div>
        
        <div id="message"></div>
        
        <div class="network-list" id="networks">
            <div style="padding: 10px; color: #666;">Scanning for networks...</div>
        </div>
        
        <form id="wifiForm">
            <input type="text" id="ssid" placeholder="WiFi Network Name" required>
            <input type="password" id="password" placeholder="WiFi Password">
            <button type="submit" id="connectBtn">Connect to WiFi</button>
        </form>
        
        <div style="margin-top: 20px; text-align: center;">
            <button onclick="checkStatus()" style="background: #2196F3;">Check Connection Status</button>
        </div>
    </div>
    
    <script>
        // Generate device ID
        const deviceId = 'SF_' + Math.random().toString(36).substr(2, 8).toUpperCase();
        document.getElementById('deviceId').textContent = deviceId;
        
        // Scan for networks
        function scanNetworks() {
            fetch('/scan')
                .then(response => response.json())
                .then(data => {
                    const networksDiv = document.getElementById('networks');
                    if (data.networks && data.networks.length > 0) {
                        networksDiv.innerHTML = '';
                        data.networks.forEach(network => {
                            const div = document.createElement('div');
                            div.className = 'network-item';
                            div.innerHTML = network.ssid + ' (' + network.rssi + ' dBm)';
                            div.onclick = () => {
                                document.getElementById('ssid').value = network.ssid;
                            };
                            networksDiv.appendChild(div);
                        });
                    } else {
                        networksDiv.innerHTML = '<div style="padding: 10px; color: #666;">No networks found</div>';
                    }
                })
                .catch(error => {
                    console.error('Scan error:', error);
                });
        }
        
        // Check connection status
        function checkStatus() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    const msg = document.getElementById('message');
                    if (data.error) {
                        msg.className = 'message error';
                        msg.textContent = 'Last error: ' + data.error;
                    } else {
                        msg.className = 'message info';
                        msg.textContent = 'Status: ' + data.status;
                    }
                });
        }
        
        // Initial scan
        setTimeout(scanNetworks, 1000);
        
        // Handle form submission
        document.getElementById('wifiForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('connectBtn');
            const msg = document.getElementById('message');
            const status = document.getElementById('status');
            
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            status.textContent = 'Attempting connection...';
            msg.className = 'message info';
            msg.textContent = 'Please wait up to 30 seconds...';
            
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
                    msg.className = 'message success';
                    msg.innerHTML = '✅ Connected successfully!<br>IP: ' + data.ip + '<br>Device will restart in 5 seconds...';
                    status.textContent = 'Connected!';
                } else {
                    msg.className = 'message error';
                    msg.innerHTML = '❌ Connection failed<br>' + (data.message || 'Please check password and try again');
                    status.textContent = 'Failed';
                    btn.disabled = false;
                    btn.textContent = 'Connect to WiFi';
                }
            })
            .catch(error => {
                msg.className = 'message error';
                msg.textContent = '❌ Error: ' + error;
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
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("Smart Filter WiFi Manager - DEBUG MODE");
  Serial.println("========================================");
  Serial.println("Serial output enabled for debugging");
  
  // Setup hardware
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize EEPROM
  EEPROM.begin(sizeof(Config));
  loadConfig();
  
  // Print current configuration
  Serial.println("\nCurrent Configuration:");
  Serial.print("Magic: "); Serial.println(config.magic);
  Serial.print("SSID: "); Serial.println(config.ssid);
  Serial.print("Password: "); Serial.println(strlen(config.password) > 0 ? "****" : "(empty)");
  Serial.print("Device ID: "); Serial.println(config.deviceId);
  Serial.print("Configured: "); Serial.println(config.configured ? "Yes" : "No");
  
  // Always start in setup mode for debugging
  Serial.println("\nStarting setup mode for debugging...");
  startSetupMode();
}

void loop() {
  // Handle DNS and web server
  dnsServer.processNextRequest();
  server.handleClient();
  
  // Blink LED in setup mode
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > 500) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastBlink = millis();
  }
  
  // Check for factory reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    static unsigned long pressTime = 0;
    if (pressTime == 0) pressTime = millis();
    if (millis() - pressTime > 5000) {
      Serial.println("\n!!! FACTORY RESET !!!");
      clearConfig();
      ESP.restart();
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
  
  // Setup DNS server
  dnsServer.start(DNS_PORT, "*", IP);
  
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/scan", handleScan);
  server.on("/configure", HTTP_POST, handleConfigure);
  server.on("/status", handleStatus);
  server.onNotFound(handleRoot);
  
  server.begin();
  Serial.println("\n✅ Setup Mode Active!");
  Serial.println("1. Connect to WiFi: " + String(AP_SSID));
  Serial.println("2. Open browser to: http://192.168.4.1");
  Serial.println("========================================\n");
}

void handleRoot() {
  Serial.println("Web request: Homepage");
  server.send(200, "text/html", SETUP_HTML);
}

void handleScan() {
  Serial.println("Web request: WiFi scan");
  String json = "{\"networks\":[";
  
  int n = WiFi.scanNetworks();
  Serial.printf("Found %d networks\n", n);
  
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"ssid\":\"" + WiFi.SSID(i) + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI(i)) + ",";
    json += "\"encrypted\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    json += "}";
    Serial.printf("  %d: %s (%d dBm)\n", i+1, WiFi.SSID(i).c_str(), WiFi.RSSI(i));
  }
  json += "]}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void handleConfigure() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  String deviceId = server.arg("deviceId");
  
  Serial.println("\n========================================");
  Serial.println("Configuration Request Received:");
  Serial.println("SSID: " + ssid);
  Serial.println("Password length: " + String(password.length()));
  Serial.println("Device ID: " + deviceId);
  Serial.println("========================================");
  
  // Save configuration
  strcpy(config.magic, "SF01");
  ssid.toCharArray(config.ssid, sizeof(config.ssid));
  password.toCharArray(config.password, sizeof(config.password));
  deviceId.toCharArray(config.deviceId, sizeof(config.deviceId));
  config.configured = true;
  
  saveConfig();
  Serial.println("Configuration saved to EEPROM");
  
  // Try to connect with detailed logging
  Serial.println("\nAttempting WiFi connection...");
  WiFi.begin(ssid.c_str(), password.c_str());
  
  // Wait for connection with status updates
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {  // 20 seconds timeout
    delay(500);
    Serial.print(".");
    
    // Print detailed status every 2 seconds
    if (attempts % 4 == 0) {
      Serial.print(" Status: ");
      switch(WiFi.status()) {
        case WL_NO_SHIELD: Serial.print("NO_SHIELD"); break;
        case WL_IDLE_STATUS: Serial.print("IDLE"); break;
        case WL_NO_SSID_AVAIL: Serial.print("NO_SSID_AVAIL"); break;
        case WL_SCAN_COMPLETED: Serial.print("SCAN_COMPLETED"); break;
        case WL_CONNECTED: Serial.print("CONNECTED"); break;
        case WL_CONNECT_FAILED: Serial.print("CONNECT_FAILED"); break;
        case WL_CONNECTION_LOST: Serial.print("CONNECTION_LOST"); break;
        case WL_DISCONNECTED: Serial.print("DISCONNECTED"); break;
        default: Serial.print("UNKNOWN"); break;
      }
    }
    attempts++;
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected Successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Send success response
    String response = "{\"success\":true,\"ip\":\"" + WiFi.localIP().toString() + "\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    lastError = "";
    
    // Restart after a delay
    Serial.println("\nRestarting in 5 seconds...");
    delay(5000);
    ESP.restart();
  } else {
    // Connection failed
    String errorMsg = "Unknown error";
    switch(WiFi.status()) {
      case WL_NO_SSID_AVAIL:
        errorMsg = "Network not found. Check SSID.";
        break;
      case WL_CONNECT_FAILED:
        errorMsg = "Connection failed. Check password.";
        break;
      case WL_DISCONNECTED:
        errorMsg = "Wrong password or network issue.";
        break;
      default:
        errorMsg = "Connection timeout. Status: " + String(WiFi.status());
        break;
    }
    
    Serial.println("\n❌ WiFi Connection Failed!");
    Serial.println("Error: " + errorMsg);
    
    lastError = errorMsg;
    
    String response = "{\"success\":false,\"message\":\"" + errorMsg + "\"}";
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", response);
    
    // Clear the failed configuration
    clearConfig();
    Serial.println("Configuration cleared due to failure");
  }
}

void handleStatus() {
  String json = "{";
  if (lastError.length() > 0) {
    json += "\"error\":\"" + lastError + "\",";
  }
  json += "\"status\":\"Setup Mode\",";
  json += "\"configured\":" + String(config.configured ? "true" : "false");
  json += "}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
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
  EEPROM.commit();
}

void clearConfig() {
  memset(&config, 0, sizeof(config));
  saveConfig();
}

bool isConfigured() {
  return strcmp(config.magic, "SF01") == 0 && config.configured;
}
