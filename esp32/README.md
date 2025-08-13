# ESP32 SDP810 Sensor Monitor

This Arduino code reads data from an SDP810 differential pressure sensor and sends it to your web application via API.

## Hardware Requirements

- ESP32 DevKit v1
- SDP810 Differential Pressure Sensor
- Jumper wires for I2C connections

## Wiring Diagram

| ESP32 Pin | SDP810 Pin | Description |
|-----------|------------|-------------|
| 3.3V      | VDD        | Power supply |
| GND       | GND        | Ground |
| GPIO 21   | SDA        | I2C Data |
| GPIO 22   | SCL        | I2C Clock |

## Arduino IDE Setup

1. **Install ESP32 Board Package:**
   - File → Preferences
   - Add this URL to Additional Board Manager URLs:
     ```
     https://dl.espressif.com/dl/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager
   - Search "ESP32" and install "ESP32 by Espressif Systems"

2. **Install Required Libraries:**
   - Sketch → Include Library → Manage Libraries
   - Install these libraries:
     - `ArduinoJson` by Benoit Blanchon
     - `WiFi` (usually pre-installed)
     - `HTTPClient` (usually pre-installed)

## Configuration

### 1. WiFi Settings
Update these lines in `sensor_monitor.ino`:
```cpp
const char* ssid = "Your_WiFi_Name";
const char* password = "Your_WiFi_Password";
```

### 2. User ID Configuration
To get your User ID:

1. **Sign in to your app** at https://mysmartfilter.com
2. **Open browser developer tools** (F12)
3. **Go to Application/Storage → Local Storage**
4. **Look for user session data** or...
5. **Use this temporary method:**

Add this tRPC query to your app to get user IDs:

```typescript
// In your app, add this to get user ID
console.log("User ID:", session?.user?.id);
```

Then update the ESP32 code:
```cpp
const char* userId = "your_actual_user_id_here";
```

### 3. Device ID (Optional)
You can customize the device identifier:
```cpp
const char* deviceId = "ESP32_SDP810_YourName";
```

## Upload Instructions

1. **Connect ESP32** to your computer via USB
2. **Select Board:** Tools → Board → ESP32 Dev Module
3. **Select Port:** Tools → Port → (your ESP32 port)
4. **Upload:** Sketch → Upload

## Monitoring

1. **Open Serial Monitor:** Tools → Serial Monitor
2. **Set baud rate to 115200**
3. **Watch for:**
   - WiFi connection status
   - Sensor readings
   - API response messages

## Troubleshooting

### WiFi Issues
- Check SSID and password
- Ensure 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Check signal strength

### Sensor Issues
- Verify I2C wiring
- Check sensor power (3.3V)
- Try different I2C addresses if needed

### API Issues
- Verify user ID is correct
- Check internet connection
- Monitor serial output for HTTP errors

## Sample Serial Output

```
ESP32 Sensor Monitor Started
Device ID: ESP32_SDP810_001
WiFi connected!
IP address: 192.168.1.100
SDP810 sensor initialized successfully

=== Sensor Reading ===
Pressure: 1013.25 Pa
Temperature: 23.5 °C
Sending: {"pressure":1013.25,"temperature":23.5,"deviceId":"ESP32_SDP810_001","userId":"user123"}
HTTP Response: 200
Response: {"success":true,"data":{"id":"abc123","timestamp":"2025-08-13T04:00:00.000Z"}}
✓ Data sent successfully
```

## Next Steps

1. **Test locally** with serial monitor
2. **Verify data appears** in your web dashboard
3. **Adjust reading interval** if needed (currently 30 seconds)
4. **Add error handling** for production use
