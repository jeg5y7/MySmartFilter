# Flashing a monitor from your browser (no tools to install)

Ready-to-flash images, each a single file written at address `0x0`:

- **`smartfilter-usb-pilot-TEST-v1.8.0.bin`** — bench-test build. Needs no
  sensor: a bare dev board sends simulated blower cycles (≈38 Pa on /
  ~0 Pa off, 15-minute cycles) to production every 30 s. Use this to prove
  the whole pipeline the day the boards arrive.
- **`smartfilter-usb-pilot-v1.8.0.bin`** — real build for assembled units
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

## v1.8.0 — stable IDs + TLS validation

- The device ID is now derived from the chip's factory MAC (`SF` + 12 hex),
  so it never changes across setups/wipes. The setup page shows it — that's
  the ID to print on the unit's QR label (**Admin → QR Labels**).
- All API and OTA traffic now validates TLS against pinned root CAs
  (Let's Encrypt + Google Trust Services) with NTP clock sync — a spoofed
  network can no longer impersonate the server or feed fake updates.

## v1.8.0 — sensor auto-zero

Drift correction learned from blower-off periods: when readings sit flat
near zero for ~10 minutes (blower off), that plateau becomes the new zero.
Makes low-cost differential sensors (XGZP-class, ~$2–3) viable for Rev B —
their offset drift self-corrects many times a day.

## v1.8.0 — field-safe OTA

- Devices check for updates on boot AND every 24 h (always-on units never
  reboot, so the daily check is what actually delivers updates).
- Anti-brick: OTA writes to the inactive flash partition (a failed download
  can't touch the running firmware), and on first boot after an update the
  new image must reach the API within ~1 min or it ROLLS ITSELF BACK to the
  previous version. Publishing happens in Admin → Firmware (1% canary →
  ramp → 100%), and only the OTA *application* updates — the bootloader is
  never touched, and browser reflash over USB always remains the fallback.

## v1.8.0 — glow-top status light (button removed)

- RGB LED (common cathode) on GPIO25/26/27 through 220 Ω each, diffused
  through the lid's thin glow window. Colors: pulsing blue = setup mode,
  amber blink = connecting, soft green = filter healthy, solid amber =
  replace soon, breathing red = replace now, fast red blink = can't reach
  the server.
- No button: pairing self-triggers when WiFi is unreachable; account
  transfer = remove the device in the app (it re-registers unclaimed);
  new filters are detected automatically from the pressure drop.
- Reversed pressure tubes (large negative readings) auto-fold positive.
- Wiring diagram: hardware/wiring-usb.svg

## v1.8.0 — reliable WiFi setup handoff (bench-test findings)

Root-caused from the first real bench test:
- The old flow tried to join home WiFi WHILE hosting the setup AP under a
  10 s deadline (routinely too short in mixed mode), dropped the phone
  mid-request (spinner timeout), and WIPED the saved credentials on
  timeout. All three fixed:
- The phone now gets an instant success page (with the Device ID and
  plain next-steps — no doomed auto-redirect), THEN the device reboots
  and joins cleanly with the AP down: two patient 30 s rounds, and
  credentials are never wiped — a failed join returns to setup mode with
  everything kept.
- Boot log now prints the firmware version.

## v1.8.0 — first successful end-to-end bench test

Verified 2026-08-15 on a real unit: captive portal → credentials saved →
joined home WiFi → registered → authenticated → live SDP810 readings
accepted by production (-0.02 Pa with hoses open, 23.9 °C).

Fixes, all of which blocked setup or corrupted data:

- **Setup could never complete on any unit.** `isConfigured()` compared the
  stored config magic against `"SF01"` while every writer stored `"SF02"`,
  so a saved configuration was never recognized — every reboot returned to
  setup mode regardless of network conditions.
- **Every authenticated call returned 401.** The server issues a 67-char
  token (`sf_` + 64 hex) but the buffer held 64, silently truncating it.
- **The setup page hung forever on "Connecting".** The portal ran a WiFi
  scan while hosting the setup AP; the scan takes the radio off-channel and
  wedges the AP data path (clients still associate and get DHCP, but TCP
  dies). The scan now runs once before the AP starts and is served cached.
- **Pressure readings were 4× too high.** The scale factor was hardcoded to
  60 (the 500Pa part) against 125Pa hardware (240). The sensor's own
  reported scale factor is now used, so either variant reads correctly.
- **Sensor faults were published as real data.** A saturated -32768 reading
  passed through the reversed-tube sign fold and became a plausible
  +136.5 Pa. Rail values are now rejected as invalid.
- Sensor init sends stop-continuous first (continuous mode survives a
  reboot, so the start command was being NACKed), and uses 0x3615
  (differential-pressure compensation) rather than 0x3603 (mass flow).
- Measurement CRCs are now validated instead of discarded.

### iPhone setup notes (worth putting in the customer guide)

- iOS routes over cellular when the setup network has no internet, so the
  page won't load. Airplane Mode (with WiFi back on) forces it back.
- After a failed attempt iOS caches "no portal here" and stops probing, so
  the page stops auto-popping. Forget This Network, then rejoin.

### Bench tip

A dead sensor looks like a firmware bug. If pressure reads exactly
±136.53 Pa (raw ±32768) or the temperature is far from room temperature,
suspect the sensor itself — swapping ours fixed it outright.

## v1.8.0 — one-tap setup handoff, adaptive sampling

- The setup success page now shows a "Finish setup" button whose link
  carries the Device ID — nothing to remember or screenshot. Wait for
  SmartFilter_Setup to disappear (phone auto-rejoins home WiFi), tap, done.
- Adaptive sampling: every 10 s while the blower runs (crisp cycle edges
  on the graph), every 60 s while idle.
