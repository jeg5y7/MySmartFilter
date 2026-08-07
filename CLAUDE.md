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

## State (2026-08-05)

- Phases 0–3 + tier enforcement all shipped to production (PRs #2–#12).
  Earlier open issues are RESOLVED: prod deploy green, SSL fixed (stale A
  record deleted), magic-link login working (DKIM + EMAIL_FROM + prod DB
  migration all fixed). Live prod DB is the us-west-2 Neon project
  (`ep-small-surf-afmlmskv`); the old us-east-1 project is stale — retire it.
- PR #13 merged: /install guide + furnace make/model live in prod (columns
  applied by user in Neon). The 📷 photo auto-identify feature was built
  then parked by founder decision — restore pointer in ROADMAP "Later /
  ideas" (commit b278ec4).
- PR #14 merged + verified live: smart-home bridge (OAuth account-linking
  server + Google/Alexa/SmartThings connectors), monitor product in the
  store ($99 placeholder price — founder to set), nav/mobile fixes. OAuth
  tables + productType column applied to prod by user in Neon.
- ⚠️ Wrong-database trap (bit us twice): Neon console often opens the STALE
  us-east-1 project. Prod SQL must run in us-west-2 (`ep-small-surf…`) —
  reach it via Vercel → Storage → Open in Neon. Founder should DELETE the
  us-east-1 project. Note: preview deployments point at a different/empty
  DB, so preview 500s on DB pages prove nothing about prod.
- Founder-side: smart-home platform accounts (docs/smart-home-bridge.md),
  monitor price, Vercel Pro decision, hardware bench test, supplier
  outreach, pilot batch.

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
- Emails: dark-slate HTML templates, from-address via ~/lib/resend.
- Energy model physics in src/lib/energy.ts — ECM blowers only accrue cost;
  PSC systems use the pressure-threshold path (real physics, keep it honest).
- Never commit .env files (`.env.production` leaked once — already handled).
