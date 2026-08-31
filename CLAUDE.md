# MySmartFilter — Claude Code context

IoT platform: ESP32 pressure sensors on HVAC filters + Next.js app (T3 stack).
Business: razor-and-blades with a freemium software split (see Tiers below).
Target: public launch ~Oct 2026. **Read ROADMAP.md for the phased plan and
current status.** Progress dashboard artifact: "MySmartFilter · Launch Control".

## Tiers (business model — keep site copy consistent with this)

- **Buy the monitor → free "live" tier:** live readings on the dashboard,
  device status, and smart-home access (Home Assistant, Google/Alexa/
  SmartThings when live) to current data. Customers own their live data.
- **Filter AutoShip (enrolled in auto filter shipping) → full software:**
  the energy-savings calculation (Filter Health meter), historical trending
  /charts, and advanced HVAC diagnostics (future feature). There is NO
  separate subscription fee — enrollment means they get their filters
  through us automatically; the premium software rides along.
- Working definition of "enrolled": ≥1 filter preference with
  autoOrderEnabled (+ card on file for it to actually work).
- Enforcement (gating history/energy UI for non-enrolled users) is a
  planned software task — as of now the copy states the tiers but the app
  does not yet enforce them.

## The product (customer's view — keep all copy consistent with this)

- The device is called the **"smart filter monitor"** in ALL customer-facing
  copy. Never ESP32 / Arduino / SDP810 / firmware / I2C — customers don't know
  or care what's inside. Technical names are fine in code, docs/, and esp32/.
- Customers NEVER flash code, wire anything, or install an app. The unit
  arrives assembled with firmware installed.
- **Install:** drill one small hole on each side of the furnace filter, insert
  the kit's two flexible tubes into the HVAC enclosure, connect the other ends
  to the monitor's ports, plug in the power adapter.
- **Onboarding:** the monitor broadcasts a temporary WiFi network → customer
  joins it from their phone → captive portal asks for home WiFi → customer
  scans the QR label to register the device to their account
  (/setup/device?device=SF… prefills the ID).
- **Then it's hands-off:** the monitor measures the pressure drop across the
  filter, the app computes wasted-energy cost vs a new filter's price, emails
  before any auto-order (one-click cancel, 24 h grace), and ships the filter.

## State (2026-08-31)

- Nordic Arch redesign live in prod: phase 1 marketing surface (PR #55 —
  brand tokens, Instrument Sans/Serif, pleats logo + icons, landing,
  header, waitlist) and phase 2 app surface (PR #56 — dashboard, devices,
  device detail incl. light chart palette, store, install, setup wizard,
  settings, auth, legal, pull-to-refresh). Phase 3 (admin + emails) in
  flight this session.
- Phases 0-3, tier enforcement, smart-home bridge, admin fleet/labels/
  firmware pages, OTA pipeline, security hardening (headers, hashed API
  keys, magic-link rate limit), and the launch waitlist are all live in
  prod (PRs #2-#53). Landing leads with "we turn every filter into a
  smart filter" + waitlist capture.
- Firmware v1.10.5-usb on the pilot unit. Hard-won field architecture:
  outage auto-recovery, hardware task watchdog + send-failure watchdog
  (silent death unreachable), sensor faults visible (error-nack/crc/temp
  heartbeats, blinking onboard LED) and self-healing (30s re-init),
  over-range readings publish PEGGED at the sensor ceiling instead of
  blacking out cycles. BLE presence glow is built but COMPILED OUT
  pending bench debug (heap/coexistence freezes). OTA semver now handles
  patch releases ("1.10.1-usb"). esp32/builds/FLASHING.md is the
  changelog of record.
- Field lessons (2026-08-21): loose jumper connectors mimic firmware
  bugs (solder the loom, no push-fit on sensor pins); a filter's max
  rated airflow matters more than MERV (an 819-CFM MERV13 pegged a
  ~1170 CFM system that runs ~120 Pa across a fresh 1389-CFM MERV11);
  visually dirty filters can be aerodynamically clean. Sensor plan:
  SDP810-500Pa standard (auto-detected scale), SDP800 manifold + cheap
  XGZP + RH chip are Rev B candidates.
- Web data lessons live in-product: baseline-relative alert threshold
  (alertCeilingPa), downward re-baseline detection, 7d/30d daily
  average-while-running bars with trend line and zoomed Y axis,
  range-scoped stats, local-timezone rendering (LocalTime), app-mode
  pull-to-refresh + freshness badge.
- New prod tables self-provision through the app (FirmwareRelease
  repair button, Waitlist auto-create) — never hand-run SQL in the Neon
  console again. Neon upgraded to Launch (~$19/mo compute floor,
  $0.106/CU-h + $0.35/GB-mo); us-east-1 project deleted, CVE bot branch
  deleted, founder 2FA done.
- Founder-side open: monitor price ($99 placeholder), Vercel Pro,
  UptimeRobot on /api/health, Stripe Tax, smart-home platform accounts,
  autoscaling cap in Neon, solder pilot unit's loom + 500Pa sensor
  swap, pilot batch build (loom + 500Pa + hot glue), MERV-right filter
  exchange, first build-in-public reel -> waitlist funnel.

## Commands

- `npm run check` — lint + typecheck (keep both clean)
- `npm run db:push` — sync Prisma schema (local dev)
- Local Postgres (no Docker daemon): `pg_ctlcluster 16 main start`, then
  `.env` → `DATABASE_URL="postgresql://postgres:password@localhost:5432/sensor-monitoring"`,
  `npm run db:push && npm run db:seed`
- Admin grant: `npx tsx scripts/make-admin.ts <email>`
- Schema-change SQL for prod (user runs it in Neon SQL editor):
  `npx prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script`

## Conventions

- Prod deploys: merge to main → Vercel auto-builds. DB columns must be added
  (Neon SQL editor) BEFORE merging code that uses them.
- User is new to dev tooling — give browser-based steps, avoid assuming
  terminal fluency; explain what each step does in plain language.
- Emails: Nordic-light HTML templates (paper #faf8f5 bg, white card with
  #eeebe4 border, ink #1c1b18 headings, sage #3e8a72 CTAs — mirrors the
  site's Nordic Arch design system), from-address via ~/lib/resend.
- UI: Nordic Arch design system site-wide — tokens in src/styles/globals.css
  (@theme); paper shells, bg-card rounded-[24px] bordered cards, font-display
  (Instrument Serif) page headings, rounded-full sage/ink buttons; status =
  sage healthy / clay warning / red-600 error; admin accent = clay.
- Energy model physics in src/lib/energy.ts — ECM: direct extra blower watts.
  PSC: system-runtime penalty (airflow loss → capacity loss → whole system
  incl. compressor runs longer; conservative constants, documented in file).
  Both accrue cost; pressure threshold stays as a parallel ceiling.
- Never commit .env files (`.env.production` leaked once — already handled).
