/**
 * MySmartFilter — Rev B battery firmware (deep-sleep batch architecture)
 *
 * Cycle: wake every SAMPLE_INTERVAL_SEC → power sensor → one triggered ΔP/temp
 * read → buffer sample in RTC memory → back to deep sleep. WiFi only turns on
 * when the buffer is full (~hourly) or an exception fires (blower state change,
 * alert-threshold crossing, low battery). Uploads go to POST /api/sensor/batch
 * with per-sample ageSeconds — no wall clock needed on the device.
 *
 * Power budget (3×AA + TPS63031): ~62 µA sleeping, ~90 mA for ~6 s per upload
 * → roughly a year on alkaline cells at the default cadence.
 *
 * Carries over from smart_filter_final.cpp: EEPROM config layout, captive
 * portal setup flow, device registration with the proof-of-possession secret,
 * BOOT-button factory reset.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <esp_sleep.h>
#include <esp_wifi.h>

#ifndef API_BASE_URL
#define API_BASE_URL "https://mysmartfilter.com/api"
#endif
#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "2.0.0-battery"
#endif

// ─── Pins (matches Hardware Rev A) ───────────────────────────────────────────
#define LED_PIN 2
#define BUTTON_PIN 0        // BOOT: hold 5 s at wake for factory reset
#define SENS_EN_PIN 26      // P-FET gate: LOW = sensor powered
#define VBAT_ADC_PIN 34     // 1M/1M divider from battery +
#define I2C_SDA 21
#define I2C_SCL 22

// ─── Sensor (Sensirion SDP810, triggered mode) ───────────────────────────────
#define SDP810_ADDRESS 0x25

// ─── Cadence ─────────────────────────────────────────────────────────────────
#define SAMPLE_INTERVAL_SEC 120        // one sample every 2 min
#define UPLOAD_BATCH_N 30              // → upload roughly every hour
#define MAX_SAMPLES 90                 // RTC buffer cap (~3 h if uploads fail)
#define BLOWER_ON_PA 5.0f              // matches server-side energy model
#define DEFAULT_ALERT_PA 50.0f         // exception-push threshold (server dedupes)
#define LOW_BATTERY_PCT 20.0f

// ─── EEPROM config (identical layout to smart_filter_final.cpp) ──────────────
#define EEPROM_SIZE 512
struct Config {
  char magic[5];
  char ssid[33];
  char password[64];
  char deviceId[17];
  char apiToken[68];
  char deviceSecret[65];
};
Config config;

// ─── RTC-persisted state (survives deep sleep, not power loss) ───────────────
struct Sample {
  uint32_t atSec;      // monotonic clock when taken
  int16_t pPa_x10;     // pressure ×10 (±3276.7 Pa range)
  int16_t tC_x10;      // temperature ×10
};
RTC_DATA_ATTR uint64_t rtcClockSec = 0;    // monotonic seconds since first boot
RTC_DATA_ATTR uint16_t sampleCount = 0;
RTC_DATA_ATTR Sample samples[MAX_SAMPLES];
RTC_DATA_ATTR float lastPressure = 0;
RTC_DATA_ATTR bool lastBlowerOn = false;
RTC_DATA_ATTR float lastBatteryPct = 100;
RTC_DATA_ATTR uint32_t lastUploadAtSec = 0;
RTC_DATA_ATTR uint16_t bootCount = 0;
// WiFi fast-connect cache: skipping the scan saves ~2 s per upload
RTC_DATA_ATTR bool wifiCacheValid = false;
RTC_DATA_ATTR uint8_t wifiChannel = 0;
RTC_DATA_ATTR uint8_t wifiBssid[6];
// Filter status cached from the last upload response (0=ok, 1=soon, 2=now)
RTC_DATA_ATTR uint8_t lastFilterStatus = 0;

WebServer server(80);
DNSServer dnsServer;

// ─── Forward declarations ────────────────────────────────────────────────────
void goToSleep();
void startAPMode();
void handleRoot();
void handleSave();
void loadConfig();
void saveConfig();
bool isConfigured();
void factoryReset();
void generateDeviceId();
void ensureDeviceSecret();
bool registerDevice();
bool connectWiFi();
bool readSensor(float &pressure, float &temperature);
float readBatteryPct();
bool uploadBatch(float batteryPct);
uint8_t crc8(const uint8_t *data, uint8_t len);

// ─── Setup = entire duty cycle (loop() never runs in normal operation) ───────
void setup() {
  // Advance the monotonic clock by the sleep we just finished (skip on cold boot)
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER) {
    rtcClockSec += SAMPLE_INTERVAL_SEC;
  }
  bootCount++;

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);          // LED stays dark to save power
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(SENS_EN_PIN, OUTPUT);
  digitalWrite(SENS_EN_PIN, HIGH);     // sensor off

  Serial.begin(115200);

  EEPROM.begin(EEPROM_SIZE);
  loadConfig();

  if (strlen(config.deviceId) == 0) {
    generateDeviceId();
    saveConfig();
  }
  ensureDeviceSecret();

  // Factory reset: BOOT held for 5 s at any wake
  if (digitalRead(BUTTON_PIN) == LOW) {
    unsigned long pressStart = millis();
    while (digitalRead(BUTTON_PIN) == LOW && millis() - pressStart < 5000) {
      digitalWrite(LED_PIN, (millis() / 100) % 2);
    }
    if (millis() - pressStart >= 5000) factoryReset();
    digitalWrite(LED_PIN, LOW);
  }

  // Unconfigured → captive portal (stays awake; customer is mid-setup)
  if (!isConfigured()) {
    Serial.println("No WiFi config — starting setup portal");
    startAPMode();
    return;  // loop() services the portal
  }

  // Button wake (short press): show filter health on the LED, then sleep.
  // OK = solid 2 s · replace soon = 3 slow blinks · replace now = 6 fast blinks
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    if (lastFilterStatus == 0) {
      digitalWrite(LED_PIN, HIGH);
      delay(2000);
    } else if (lastFilterStatus == 1) {
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH); delay(400);
        digitalWrite(LED_PIN, LOW);  delay(400);
      }
    } else {
      for (int i = 0; i < 6; i++) {
        digitalWrite(LED_PIN, HIGH); delay(120);
        digitalWrite(LED_PIN, LOW);  delay(120);
      }
    }
    digitalWrite(LED_PIN, LOW);
    goToSleep();
    return;
  }

  // ── 1. Sample ──────────────────────────────────────────────────────────────
  float pressure = 0, temperature = 0;
  bool haveReading = readSensor(pressure, temperature);
  float batteryPct = readBatteryPct();

  bool exception = false;
  if (haveReading) {
    if (sampleCount < MAX_SAMPLES) {
      samples[sampleCount++] = {
        (uint32_t)rtcClockSec,
        (int16_t)lroundf(pressure * 10.0f),
        (int16_t)lroundf(temperature * 10.0f),
      };
    } else {
      // Buffer full and uploads failing: drop the oldest, keep the newest
      memmove(&samples[0], &samples[1], sizeof(Sample) * (MAX_SAMPLES - 1));
      samples[MAX_SAMPLES - 1] = {
        (uint32_t)rtcClockSec,
        (int16_t)lroundf(pressure * 10.0f),
        (int16_t)lroundf(temperature * 10.0f),
      };
    }

    // Exceptions connect immediately instead of waiting for the batch
    bool blowerOn = pressure >= BLOWER_ON_PA;
    if (blowerOn != lastBlowerOn) exception = true;                       // runtime edge
    if (pressure >= DEFAULT_ALERT_PA && lastPressure < DEFAULT_ALERT_PA)  // alert crossing
      exception = true;
    if (batteryPct <= LOW_BATTERY_PCT && lastBatteryPct > LOW_BATTERY_PCT)
      exception = true;                                                    // battery warning
    lastBlowerOn = blowerOn;
    lastPressure = pressure;
  }
  lastBatteryPct = batteryPct;

  // ── 2. Upload when due ─────────────────────────────────────────────────────
  bool batchFull = sampleCount >= UPLOAD_BATCH_N;
  bool overdue = (rtcClockSec - lastUploadAtSec) >= (uint64_t)(2 * UPLOAD_BATCH_N * SAMPLE_INTERVAL_SEC);
  if (sampleCount > 0 && (batchFull || exception || overdue)) {
    if (connectWiFi()) {
      if (strlen(config.apiToken) == 0) registerDevice();
      if (strlen(config.apiToken) > 0 && uploadBatch(batteryPct)) {
        sampleCount = 0;
        lastUploadAtSec = (uint32_t)rtcClockSec;
      }
    }
    // Failed connects/uploads keep the buffer; next wake retries via `overdue`
  }

  // ── 3. Sleep ───────────────────────────────────────────────────────────────
  goToSleep();
}

void loop() {
  // Only reached in captive-portal mode
  dnsServer.processNextRequest();
  server.handleClient();
}

void goToSleep() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  digitalWrite(SENS_EN_PIN, HIGH);  // sensor off
  esp_sleep_enable_timer_wakeup((uint64_t)SAMPLE_INTERVAL_SEC * 1000000ULL);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);  // BOOT button wakes for reset access
  esp_deep_sleep_start();
}

// ─── Sensor: one triggered measurement, sensor powered only while reading ────
bool readSensor(float &pressure, float &temperature) {
#ifdef SKIP_SENSOR
  pressure = 20.0f + (rtcClockSec % 600 < 300 ? 35.0f : 0.0f);  // fake blower cycles
  temperature = 21.5f;
  return true;
#endif
  digitalWrite(SENS_EN_PIN, LOW);   // power up
  delay(25);                        // SDP810 power-up time

  pinMode(I2C_SDA, INPUT_PULLUP);
  pinMode(I2C_SCL, INPUT_PULLUP);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);

  // Triggered, differential-pressure-temperature-compensated measurement
  Wire.beginTransmission(SDP810_ADDRESS);
  Wire.write(0x36);
  Wire.write(0x2F);
  if (Wire.endTransmission() != 0) {
    digitalWrite(SENS_EN_PIN, HIGH);
    return false;
  }
  delay(50);  // conversion time

  uint8_t data[9];
  if (Wire.requestFrom((int)SDP810_ADDRESS, 9) != 9) {
    digitalWrite(SENS_EN_PIN, HIGH);
    return false;
  }
  for (int i = 0; i < 9; i++) data[i] = Wire.read();
  digitalWrite(SENS_EN_PIN, HIGH);  // power down immediately

  if (crc8(&data[0], 2) != data[2]) return false;
  if (crc8(&data[3], 2) != data[5]) return false;
  if (crc8(&data[6], 2) != data[8]) return false;

  int16_t dp_raw = (int16_t)((data[0] << 8) | data[1]);
  int16_t temp_raw = (int16_t)((data[3] << 8) | data[4]);
  int16_t scale_raw = (int16_t)((data[6] << 8) | data[7]);

  float scale = (scale_raw > 0) ? (float)scale_raw : 60.0f;  // sensor self-reports
  pressure = dp_raw / scale;
  temperature = temp_raw / 200.0f;
  return true;
}

// ─── Battery: 1M/1M divider → ADC, mapped across the 3×AA discharge curve ────
float readBatteryPct() {
  analogSetPinAttenuation(VBAT_ADC_PIN, ADC_11db);  // full 0–3.3 V range
  uint32_t mvSum = 0;
  for (int i = 0; i < 8; i++) mvSum += analogReadMilliVolts(VBAT_ADC_PIN);
  float packV = (mvSum / 8) * 2.0f / 1000.0f;  // ×2 for the divider

  // 3×AA alkaline: 4.8 V fresh → 3.0 V empty (ESP32 brownout territory below)
  float pct = (packV - 3.0f) / (4.8f - 3.0f) * 100.0f;
  return constrain(pct, 0.0f, 100.0f);
}

// ─── WiFi: fast reconnect via cached channel/BSSID, fall back to full scan ───
bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  if (wifiCacheValid) {
    WiFi.begin(config.ssid, config.password, wifiChannel, wifiBssid, true);
  } else {
    WiFi.begin(config.ssid, config.password);
  }

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) delay(50);

  if (WiFi.status() != WL_CONNECTED && wifiCacheValid) {
    // Router may have changed channel — retry with a full scan
    wifiCacheValid = false;
    WiFi.disconnect(true);
    WiFi.begin(config.ssid, config.password);
    start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) delay(50);
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiChannel = WiFi.channel();
    memcpy(wifiBssid, WiFi.BSSID(), 6);
    wifiCacheValid = true;
    return true;
  }
  return false;
}

// ─── Batch upload ────────────────────────────────────────────────────────────
bool uploadBatch(float batteryPct) {
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/sensor/batch";

  bool https = url.startsWith("https");
  if (https) {
    secureClient.setInsecure();  // TODO(pilot): pin the ISRG Root X1 CA
    if (!http.begin(secureClient, url)) return false;
  } else {
    if (!http.begin(plainClient, url)) return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + config.apiToken);
  http.setTimeout(15000);

  JsonDocument doc;
  JsonArray readings = doc["readings"].to<JsonArray>();
  for (uint16_t i = 0; i < sampleCount; i++) {
    JsonObject r = readings.add<JsonObject>();
    r["pressure"] = samples[i].pPa_x10 / 10.0f;
    r["temperature"] = samples[i].tC_x10 / 10.0f;
    r["ageSeconds"] = (uint32_t)(rtcClockSec - samples[i].atSec);
  }
  doc["batteryPct"] = batteryPct;
  doc["reportingIntervalMin"] = (UPLOAD_BATCH_N * SAMPLE_INTERVAL_SEC) / 60;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);

  if (code == 401 && strlen(config.deviceSecret) > 0) {
    // Token rotated/lost server-side: re-register with our secret, retry once
    http.end();
    memset(config.apiToken, 0, sizeof(config.apiToken));
    if (registerDevice()) {
      if (https) { if (!http.begin(secureClient, url)) return false; }
      else { if (!http.begin(plainClient, url)) return false; }
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + config.apiToken);
      http.setTimeout(15000);
      code = http.POST(body);
    }
  }

  if (code == 200) {
    // Cache the server's filter verdict for the button-press LED display
    JsonDocument resp;
    if (deserializeJson(resp, http.getString()) == DeserializationError::Ok &&
        resp["filterStatus"].is<const char *>()) {
      const char *s = resp["filterStatus"];
      lastFilterStatus =
          strcmp(s, "replace_now") == 0 ? 2 : strcmp(s, "replace_soon") == 0 ? 1 : 0;
    }
  }

  http.end();
  return code == 200;
}

// ─── Registration (device-secret handshake, same protocol as Rev A) ──────────
bool registerDevice() {
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/device/register";

  if (url.startsWith("https")) {
    secureClient.setInsecure();
    if (!http.begin(secureClient, url)) return false;
  } else {
    if (!http.begin(plainClient, url)) return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);

  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["type"] = "SmartFilter";
  doc["firmware"] = FIRMWARE_VERSION;
  doc["deviceSecret"] = config.deviceSecret;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  bool ok = false;
  if (code == 200) {
    JsonDocument resp;
    if (deserializeJson(resp, http.getString()) == DeserializationError::Ok &&
        resp["success"] && resp["token"].is<const char *>()) {
      strlcpy(config.apiToken, resp["token"], sizeof(config.apiToken));
      saveConfig();
      ok = true;
    }
  }
  http.end();
  return ok;
}

// ─── Identity ────────────────────────────────────────────────────────────────
void generateDeviceId() {
  const char chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  uint8_t mac[6];
  WiFi.macAddress(mac);
  randomSeed(mac[5] + (mac[4] << 8) + (mac[3] << 16) + esp_random());
  strcpy(config.deviceId, "SF");
  for (int i = 2; i < 16; i++) config.deviceId[i] = chars[random(0, 36)];
  config.deviceId[16] = '\0';
}

void ensureDeviceSecret() {
  bool valid = strlen(config.deviceSecret) == 64;
  if (valid) {
    for (int i = 0; i < 64; i++) {
      char c = config.deviceSecret[i];
      if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) { valid = false; break; }
    }
  }
  if (valid) return;
  const char hex[] = "0123456789abcdef";
  for (int i = 0; i < 32; i++) {
    uint32_t r = esp_random();
    config.deviceSecret[i * 2] = hex[r & 0x0F];
    config.deviceSecret[i * 2 + 1] = hex[(r >> 4) & 0x0F];
  }
  config.deviceSecret[64] = '\0';
  saveConfig();
}

// ─── Captive portal (customer setup — device stays awake) ────────────────────
const char *setupHTML = R"(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Smart Filter Monitor Setup</title>
  <style>
    body { font-family: -apple-system, Arial, sans-serif; margin: 20px; background: #f0f4f8; }
    .container { max-width: 400px; margin: 0 auto; background: white; padding: 24px; border-radius: 12px; }
    h2 { color: #1e293b; }
    input { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; }
    button { width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
    .info { background: #eff6ff; padding: 12px; border-radius: 8px; margin: 12px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Connect your monitor</h2>
    <div class="info">Monitor ID: <b style="font-family: monospace;">%DEVICE_ID%</b></div>
    <form action="/save" method="POST">
      <label>Home WiFi network:</label>
      <input type="text" name="ssid" required placeholder="WiFi name">
      <label>WiFi password:</label>
      <input type="password" name="password" required placeholder="WiFi password">
      <button type="submit">Connect</button>
    </form>
    <p style="color: #64748b; font-size: 13px;">
      After it connects, scan the QR code on your monitor to add it to your account.
    </p>
  </div>
</body>
</html>
)";

void startAPMode() {
  digitalWrite(LED_PIN, HIGH);  // solid LED = setup mode
  WiFi.mode(WIFI_AP);
  String apName = String("SmartFilter_") + &config.deviceId[10];
  WiFi.softAP(apName.c_str());
  dnsServer.start(53, "*", WiFi.softAPIP());
  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);  // captive-portal catch-all
  server.begin();
}

void handleRoot() {
  String html = setupHTML;
  html.replace("%DEVICE_ID%", config.deviceId);
  server.send(200, "text/html", html);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  strcpy(config.magic, "WIFI");
  ssid.toCharArray(config.ssid, sizeof(config.ssid));
  password.toCharArray(config.password, sizeof(config.password));
  memset(config.apiToken, 0, sizeof(config.apiToken));  // fresh link on new WiFi
  saveConfig();

  server.send(200, "text/html",
              "<html><body style='font-family: Arial; padding: 24px;'>"
              "<h2>Saved!</h2><p>Your monitor will now connect to <b>" + ssid +
              "</b>. Scan the QR code on the monitor to finish setup.</p></body></html>");
  delay(2500);
  wifiCacheValid = false;
  ESP.restart();
}

// ─── EEPROM ──────────────────────────────────────────────────────────────────
void loadConfig() {
  EEPROM.get(0, config);
  if (strcmp(config.magic, "WIFI") != 0) memset(&config, 0, sizeof(config));
}

void saveConfig() {
  if (strcmp(config.magic, "WIFI") != 0) strcpy(config.magic, "WIFI");
  EEPROM.put(0, config);
  EEPROM.commit();
}

bool isConfigured() { return strlen(config.ssid) > 0; }

void factoryReset() {
  for (int i = 0; i < 20; i++) { digitalWrite(LED_PIN, i % 2); delay(50); }
  memset(&config, 0, sizeof(config));
  EEPROM.put(0, config);
  EEPROM.commit();
  sampleCount = 0;
  rtcClockSec = 0;
  wifiCacheValid = false;
  ESP.restart();
}

// ─── Sensirion CRC-8 (poly 0x31, init 0xFF) ─────────────────────────────────
uint8_t crc8(const uint8_t *data, uint8_t len) {
  uint8_t crc = 0xFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t b = 0; b < 8; b++) {
      crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x31) : (uint8_t)(crc << 1);
    }
  }
  return crc;
}
