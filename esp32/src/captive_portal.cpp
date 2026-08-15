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
#include <Update.h>
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
  // Appended after SF02 shipped — layout stays SF02-compatible (older
  // firmware simply reads a shorter struct). Only the exact value 1 means
  // "OTA applied, awaiting proof of life" (uninitialized EEPROM is 0xFF).
  uint8_t otaPending;
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
#define LED_PIN 2      // Built-in LED (dev board) — mirrors "online"
#define LED_R_PIN 25   // Glow-top RGB LED (common cathode, 220 Ω per leg)
#define LED_G_PIN 26
#define LED_B_PIN 27

// ── Glow-top status light ────────────────────────────────────────────────────
// The lid diffuses an RGB LED into an ambient status glow (no button):
//   pulsing blue   = setup mode (join SmartFilter_Setup from your phone)
//   amber blink    = connecting to WiFi
//   soft green     = online, filter healthy
//   solid amber    = filter due soon
//   breathing red  = replace filter now
//   fast red blink = can't reach MySmartFilter (check WiFi/internet)
enum GlowState {
  GLOW_SETUP,
  GLOW_CONNECTING,
  GLOW_OK,
  GLOW_SOON,
  GLOW_NOW,
  GLOW_ERROR,
};
static GlowState glowState = GLOW_CONNECTING;
static char lastFilterStatus[16] = "ok";

void glowSet(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(0, r);
  ledcWrite(1, g);
  ledcWrite(2, b);
}

// Non-blocking update, call every loop pass. Breathing = triangle wave.
void glowTick() {
  unsigned long t = millis();
  uint8_t tri = (t / 8) % 512;            // 0..511 over ~4 s
  if (tri > 255) tri = 511 - tri;         // triangle 0..255..0
  bool blinkSlow = (t / 500) % 2 == 0;
  bool blinkFast = (t / 150) % 2 == 0;

  switch (glowState) {
    case GLOW_SETUP:      glowSet(0, 0, 40 + (tri * 3) / 4); break;
    case GLOW_CONNECTING: glowSet(blinkSlow ? 180 : 0, blinkSlow ? 90 : 0, 0); break;
    case GLOW_OK:         glowSet(0, 60, 4); break;              // calm, dim green
    case GLOW_SOON:       glowSet(200, 90, 0); break;            // amber
    case GLOW_NOW:        glowSet(40 + (tri * 6) / 8, 0, 0); break; // breathing red
    case GLOW_ERROR:      glowSet(blinkFast ? 220 : 0, 0, 0); break;
  }
}

void glowFromFilterStatus() {
  if (strcmp(lastFilterStatus, "replace_now") == 0) glowState = GLOW_NOW;
  else if (strcmp(lastFilterStatus, "replace_soon") == 0) glowState = GLOW_SOON;
  else glowState = GLOW_OK;
}

// Global objects
WebServer server(80);
DNSServer dnsServer;
Config config;
WiFiClientSecure apiClient;  // TLS with pinned root CAs for all API calls
bool wifiConnected = false;
bool lastSendOk = false;
unsigned long lastReading = 0;
const unsigned long readingInterval = 30000;  // 30 seconds

// Sensor data structure
struct SensorData {
  float pressure;
  float temperature;
  bool valid;
};

// ── Sensor auto-zero ─────────────────────────────────────────────────────────
// Cheap MEMS differential sensors drift a few Pa; the blower being OFF is a
// free zero reference (true ΔP ≈ 0). When readings sit dead-flat near the
// current zero for a full window (~10 min at 30 s cadence), that plateau IS
// zero — adopt it. Dual guard: stability (blower-on air is turbulent) and
// proximity (a genuine steady pressure far from zero is never adopted).
static float azZeroOffset = 0.0f;
static const int AZ_WINDOW = 20;
static const float AZ_STABILITY_PA = 2.0f;   // max spread of an "off" plateau
static const float AZ_MAX_DRIFT_PA = 15.0f;  // max believable drift step
static float azBuf[AZ_WINDOW];
static int azCount = 0, azIdx = 0;

float applyAutoZero(float raw) {
  azBuf[azIdx] = raw;
  azIdx = (azIdx + 1) % AZ_WINDOW;
  if (azCount < AZ_WINDOW) azCount++;

  if (azCount == AZ_WINDOW) {
    float mn = azBuf[0], mx = azBuf[0], sum = 0;
    for (int i = 0; i < AZ_WINDOW; i++) {
      mn = min(mn, azBuf[i]);
      mx = max(mx, azBuf[i]);
      sum += azBuf[i];
    }
    float mean = sum / AZ_WINDOW;
    if ((mx - mn) < AZ_STABILITY_PA && fabsf(mean - azZeroOffset) < AZ_MAX_DRIFT_PA) {
      azZeroOffset = mean;
    }
  }
  return raw - azZeroOffset;
}

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
                    const id = data.deviceId || deviceId;
                    msg.innerHTML = `
                      <p class="success">✓ Saved! The monitor is connecting to your WiFi now.</p>
                      <div class="step" style="margin-top:12px;">
                        <strong>Almost done — 2 steps:</strong><br>
                        1. This SmartFilter_Setup network will disappear shortly.
                        Reconnect your phone to your <strong>home WiFi</strong>.<br>
                        2. Then visit <strong>mysmartfilter.com/setup/device</strong>
                        and enter this Device ID:
                        <div class="device-id">${id}</div>
                        (If SmartFilter_Setup reappears after a minute, the WiFi
                        password didn't work — join it again and retry.)
                      </div>`;
                    btn.style.display = 'none';
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
void validateOtaBoot();
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

// Scan results are cached before the AP starts: WiFi.scanNetworks() flips
// the radio into STA mode and goes off-channel mid-scan, which drops or
// wedges soft-AP clients — the AP keeps beaconing but DHCP/TCP go dead.
// Scanning with no AP up (and no clients) is safe.
String cachedScanJson = "{\"networks\":[]}";

static String buildScanJson(int n) {
  String json = "{\"networks\":[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"ssid\":\"" + WiFi.SSID(i) + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI(i)) + ",";
    json += "\"encrypted\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    json += "}";
  }
  json += "]}";
  return json;
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\nSmart Filter WiFi Manager Starting...");
  Serial.printf("Firmware: %s\n", FIRMWARE_VERSION);
  
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
  // Glow-top RGB: 5 kHz PWM, 8-bit, one channel per color leg
  ledcSetup(0, 5000, 8); ledcAttachPin(LED_R_PIN, 0);
  ledcSetup(1, 5000, 8); ledcAttachPin(LED_G_PIN, 1);
  ledcSetup(2, 5000, 8); ledcAttachPin(LED_B_PIN, 2);
  glowSet(0, 0, 0);
  
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
  glowTick();

  if (WiFi.getMode() == WIFI_AP) {
    glowState = GLOW_SETUP;
    // Handle DNS and web server in AP mode
    dnsServer.processNextRequest();
    server.handleClient();
  } else if (wifiConnected) {
    // Normal operation - read sensor and send data
    if (millis() - lastReading >= readingInterval) {
      SensorData data = readSDP810();
      
      if (data.valid) {
        Serial.printf("Pressure: %.2f Pa, Temperature: %.2f °C\n", 
                      data.pressure, data.temperature);
        
        if (sendSensorData(data)) {
          Serial.println("✓ Data sent successfully");
          lastSendOk = true;
          digitalWrite(LED_PIN, HIGH);   // onboard LED mirrors "online"
          glowFromFilterStatus();        // glow shows the server's verdict
        } else {
          Serial.println("✗ Failed to send data");
          lastSendOk = false;
          digitalWrite(LED_PIN, LOW);
          glowState = GLOW_ERROR;
        }
      }
      
      lastReading = millis();
    }
    
    // Always-on units rarely reboot — re-check for updates daily
    static unsigned long lastOtaCheck = millis();
    if ((unsigned long)(millis() - lastOtaCheck) >= 24UL * 3600UL * 1000UL) {
      lastOtaCheck = millis();
      checkOTAUpdate();
    }

    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      wifiConnected = connectToWiFi();
    }
  }
}

void startSetupMode() {
  // Scan for networks BEFORE hosting the AP (see cachedScanJson comment).
  WiFi.mode(WIFI_AP_STA);
  Serial.println("[setup] pre-AP WiFi scan starting");
  int n = WiFi.scanNetworks();
  Serial.printf("[setup] pre-AP scan done: %d networks\n", n);
  cachedScanJson = buildScanJson(n);
  WiFi.scanDelete();

  // Back to pure AP before serving. Leaving the STA interface up (AP_STA)
  // lets association and DHCP succeed while TCP never reaches the server —
  // a silent failure that looks exactly like a dead web server.
  WiFi.mode(WIFI_AP);
  delay(100);

  // Trace AP client joins/leaves so a silent data-path failure is visible
  // on serial even when no HTTP arrives
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    if (event == ARDUINO_EVENT_WIFI_AP_STACONNECTED) {
      Serial.println("[ap] client associated");
    } else if (event == ARDUINO_EVENT_WIFI_AP_STADISCONNECTED) {
      Serial.println("[ap] client disconnected");
    } else if (event == ARDUINO_EVENT_WIFI_AP_STAIPASSIGNED) {
      Serial.println("[ap] client got DHCP lease");
    }
  });

  // Create AP
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
    Serial.println("[http] GET /deviceinfo");
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
  Serial.printf("[http] %s %s -> root page\n",
                server.method() == HTTP_POST ? "POST" : "GET",
                server.uri().c_str());
  server.send(200, "text/html", SETUP_HTML);
}

void handleScan() {
  // Never scan while the AP has clients — serve the pre-AP cache
  Serial.println("[http] GET /scan (cached)");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", cachedScanJson);
}

void handleConfigure() {
  Serial.println("[http] POST /configure");
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

  // Respond to the phone FIRST, while the AP link is still solid — joining
  // the home network while hosting the AP drops clients mid-request (the
  // old flow's "spinner timeout"). The actual join happens after reboot,
  // with the AP down and a patient window. Credentials are NEVER wiped on
  // a failed join — the device just returns to setup mode with them kept.
  String response = String("{\"success\":true,\"deviceId\":\"") +
                    config.deviceId + "\"}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", response);
  Serial.println("Config saved — rebooting to join the home network");
  delay(1500);  // let the response flush to the phone
  ESP.restart();
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

  // Arm the boot-validation flag BEFORE flashing: if the new image can't
  // prove it works (reach the API) on first boot, it rolls itself back.
  config.otaPending = 1;
  saveConfig();

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
      // Nothing was flashed — disarm the boot-validation flag
      config.otaPending = 0;
      saveConfig();
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

/**
 * validateOtaBoot()
 *
 * First boot after an OTA flash: the new image must prove it can reach the
 * API over pinned TLS. Three failed attempts → automatic rollback to the
 * previous firmware (still intact in the other partition). This is the
 * anti-brick guarantee: a bad update reverts itself in the field.
 */
void validateOtaBoot() {
  if (config.otaPending != 1) return;

  Serial.println("[OTA] First boot after update — validating...");
  for (int attempt = 1; attempt <= 3; attempt++) {
    HTTPClient http;
    String url = String(API_BASE_URL_STR) + "/health";
    http.begin(apiClient, url);
    int code = http.GET();
    http.end();
    if (code == 200) {
      Serial.println("[OTA] Validation OK — update accepted");
      config.otaPending = 0;
      saveConfig();
      return;
    }
    Serial.printf("[OTA] Validation attempt %d failed (HTTP %d)\n", attempt, code);
    delay(20000);
  }

  Serial.println("[OTA] Validation FAILED — rolling back to previous firmware");
  config.otaPending = 0;
  saveConfig();
  if (Update.canRollBack()) {
    Update.rollBack();
    ESP.restart();
  } else {
    Serial.println("[OTA] Rollback unavailable — continuing on current image");
  }
}

void startNormalOperation() {
  wifiConnected = true;
  // If this boot is the first after an OTA, prove the image works or revert
  validateOtaBoot();
  // Register device with backend (obtains/refreshes API token)
  registerDevice();
  // Check for OTA firmware update on every boot
  checkOTAUpdate();
}

bool connectToWiFi() {
  if (strlen(config.ssid) == 0) {
    return false;
  }

  glowState = GLOW_CONNECTING;
  WiFi.mode(WIFI_STA);

  // Two patient rounds (30 s each) — first joins after a fresh config
  // save deserve real time, and a router mid-reboot deserves a second try
  for (int round = 0; round < 2 && WiFi.status() != WL_CONNECTED; round++) {
    if (round > 0) {
      Serial.println("\nRetrying WiFi connection...");
      WiFi.disconnect(true);
      delay(1000);
    }
    WiFi.begin(config.ssid, config.password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
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

  if (success) {
    // The server replies with its filter verdict — cache it for the glow
    DynamicJsonDocument resp(256);
    if (deserializeJson(resp, http.getString()) == DeserializationError::Ok &&
        resp["filterStatus"].is<const char*>()) {
      strlcpy(lastFilterStatus, resp["filterStatus"].as<const char*>(),
              sizeof(lastFilterStatus));
    }
  } else {
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
    
    data.pressure = applyAutoZero(pressureRaw / 60.0);
    // Reversed tubes read as large negative pressure — honor the install
    // guide's "either tube can be A or B" by folding the sign over. Small
    // negative noise near zero is left alone.
    if (data.pressure < -5.0f) data.pressure = -data.pressure;
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
