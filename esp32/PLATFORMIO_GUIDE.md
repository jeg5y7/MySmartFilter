# PlatformIO Development Guide

## Why PlatformIO Over Arduino IDE?

### For Development & Testing:
✅ **Version Control** - All config in text files (platformio.ini)
✅ **Multiple Environments** - Dev/Test/Prod configurations
✅ **Better IDE** - VS Code with IntelliSense, debugging
✅ **Dependency Management** - Libraries versioned and auto-installed
✅ **Command Line** - Scriptable builds for CI/CD
✅ **Faster Compilation** - Only recompiles changed files

### For Production:
✅ **Reproducible Builds** - Exact library versions locked
✅ **CI/CD Integration** - GitHub Actions, GitLab CI support
✅ **OTA Updates** - Built-in over-the-air update support
✅ **Multiple Boards** - Easy to support different hardware
✅ **Professional Debugging** - JTAG, Serial debugging
✅ **Unit Testing** - Built-in test framework

## Quick Commands

### Building
```bash
# Build for development (local server)
platformio run -e esp32-dev

# Build for production
platformio run -e esp32-prod

# Build for testing (no sensor required)
platformio run -e esp32-test

# Clean build files
platformio run -t clean
```

### Uploading to ESP32
```bash
# Upload to ESP32 (auto-detects port)
platformio run -e esp32-dev -t upload

# Upload to specific port
platformio run -e esp32-dev -t upload --upload-port /dev/tty.usbserial-0001

# Upload and monitor
platformio run -e esp32-dev -t upload -t monitor
```

### Monitoring
```bash
# Monitor serial output
platformio run -e esp32-dev -t monitor

# Monitor with custom baud rate
platformio device monitor -b 115200
```

### Testing Without Hardware
```bash
# Use test environment (generates fake sensor data)
platformio run -e esp32-test -t upload -t monitor
```

## VS Code Integration

1. **Install PlatformIO IDE Extension**
   - Open VS Code
   - Install "PlatformIO IDE" extension
   - Restart VS Code

2. **Open Project**
   - File → Open Folder → Select `/esp32` folder
   - PlatformIO will auto-detect project

3. **Use GUI Controls**
   - Bottom toolbar shows:
     - ✓ Build
     - → Upload
     - 🗑 Clean
     - 📟 Serial Monitor
     - 🏠 PlatformIO Home

## Environment Configuration

### Current Environments:

| Environment | API Server | Debug | Sensor | Use Case |
|------------|------------|-------|--------|----------|
| esp32-dev | Local (10.0.0.21:3000) | Yes | Yes | Development |
| esp32-prod | Production (mysmartfilter.com) | No | Yes | Production |
| esp32-test | Local | Yes | No (Fake) | Testing without hardware |

### Switching Environments:
```bash
# For local development
platformio run -e esp32-dev -t upload

# For production
platformio run -e esp32-prod -t upload

# For testing
platformio run -e esp32-test -t upload
```

## Setting Up Your Device

### 1. First Time Setup
```bash
# 1. Edit src/main.cpp or use WiFi Manager version
# 2. Set your WiFi credentials in config
# 3. Build and upload
platformio run -e esp32-dev -t upload -t monitor
```

### 2. Register Device
The device will auto-register on first boot and save the API token.

### 3. Factory Reset
Hold BOOT button for 5 seconds to clear all settings.

## Library Management

### Current Libraries:
- ArduinoJson 7.0.4 - JSON parsing
- Built-in: WiFi, HTTPClient, Wire, EEPROM

### Adding New Libraries:
```bash
# Search for libraries
platformio lib search "library name"

# Install library
platformio lib install "bblanchon/ArduinoJson@^7.0.4"

# Or add to platformio.ini:
lib_deps = 
    bblanchon/ArduinoJson@^7.0.4
    other/library@^1.0.0
```

## OTA Updates (Future)

### Setup OTA:
1. Upload initial firmware via USB
2. Note device IP address
3. Update platformio.ini with device IP
4. Use OTA environment:
```bash
platformio run -e esp32-ota -t upload
```

## CI/CD Integration

### GitHub Actions Example:
```yaml
name: Build ESP32 Firmware

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
    - name: Install PlatformIO
      run: pip install platformio
    - name: Build firmware
      run: |
        cd esp32
        platformio run -e esp32-prod
    - name: Upload firmware
      uses: actions/upload-artifact@v3
      with:
        name: firmware
        path: esp32/.pio/build/esp32-prod/firmware.bin
```

## Troubleshooting

### Port Not Found
```bash
# List available ports
platformio device list

# On macOS, look for:
# /dev/tty.usbserial-*
# /dev/tty.SLAB_USBtoUART
```

### Upload Fails
- Hold BOOT button while uploading starts
- Try slower upload speed in platformio.ini
- Check USB cable (some are charge-only)

### Build Errors
```bash
# Clean and rebuild
platformio run -t clean
platformio run -e esp32-dev

# Update platforms and libraries
platformio update
platformio lib update
```

## Production Deployment

### Best Practices:
1. **Use Production Environment**
   ```bash
   platformio run -e esp32-prod
   ```

2. **Version Your Firmware**
   - Update version in main.cpp
   - Tag git releases

3. **Test OTA Updates**
   - Test on dev devices first
   - Have rollback plan

4. **Monitor Devices**
   - Check device status endpoint
   - Set up alerts for offline devices

5. **Secure Your Tokens**
   - Never commit API tokens
   - Use secure storage
   - Rotate tokens periodically

## Summary

**Arduino IDE**: Good for beginners, quick prototypes
**PlatformIO**: Professional development, production deployment

For your smart filter product, PlatformIO is the right choice because:
- Manages multiple devices/configurations
- Integrates with your CI/CD pipeline
- Supports OTA updates for deployed devices
- Professional debugging capabilities
- Reproducible builds for production
