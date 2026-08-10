# Flashing a monitor from your browser (no tools to install)

Ready-to-flash images, each a single file written at address `0x0`:

- **`smartfilter-usb-pilot-TEST-v1.2.0.bin`** — bench-test build. Needs no
  sensor: a bare dev board sends simulated blower cycles (≈38 Pa on /
  ~0 Pa off, 15-minute cycles) to production every 30 s. Use this to prove
  the whole pipeline the day the boards arrive.
- **`smartfilter-usb-pilot-v1.2.0.bin`** — real build for assembled units
  with the SDP810 wired (I2C on pins 21/22).

Both include the captive-portal WiFi setup and the device-secret handshake.

## Steps (Chrome or Edge on a computer — phones can't do this part)

1. Plug the board into the computer with a **data** USB cable (some charge-
   only cables won't work — if no port shows up in step 3, try another cable).
2. Open **https://espressif.github.io/esptool-js/** (Espressif's official
   web flasher).
3. Under Program: Baudrate 460800 → click **Connect** → pick the port
   (usually "CP2102 USB to UART" or "USB Serial").
4. Flash Address: **0x0** · File: choose the `.bin` → click **Program**.
5. Wait for "Leaving... Hard resetting" (~1 min), then unplug/replug the
   board.

## After flashing — the customer setup flow

1. The board broadcasts WiFi network **SmartFilter_Setup** — join it from
   your phone.
2. The setup page pops up (if not, open any web page); pick your home WiFi
   and enter its password.
3. It redirects to mysmartfilter.com/setup/device to link the monitor to
   your account.
4. Within a minute or two the device shows readings on the dashboard, and
   in the Admin fleet dashboard.

Factory reset (wipe WiFi + relink): reflash, or hold the board's BOOT
button while tapping EN, then reflash.

## v1.2.0 — stable IDs + TLS validation

- The device ID is now derived from the chip's factory MAC (`SF` + 12 hex),
  so it never changes across setups/wipes. The setup page shows it — that's
  the ID to print on the unit's QR label (**Admin → QR Labels**).
- All API and OTA traffic now validates TLS against pinned root CAs
  (Let's Encrypt + Google Trust Services) with NTP clock sync — a spoofed
  network can no longer impersonate the server or feed fake updates.
