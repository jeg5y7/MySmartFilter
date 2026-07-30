# MySmartFilter

End-to-end IoT platform for monitoring HVAC air filters. Pairs **ESP32 sensor
hardware** with a **Next.js web app** that visualises live readings, alerts
owners when a filter is loaded, and can auto-order replacements through Stripe.

Hosted at <https://mysmartfilter.com>.

See [ROADMAP.md](./ROADMAP.md) for the path to public launch.

## Features

- **Energy-cost filter model** — blower runtime is detected from ΔP (pressure
  across the filter is ~0 when the blower is off), extra electricity vs. a
  clean-filter baseline is accrued on every reading, and a replacement is
  alerted/auto-ordered once that cost meets the price of the customer's
  preferred filter. ECM (variable-speed) systems only; PSC systems use the
  pressure threshold.
- **Device fleet management** — pair / rename / relocate / delete ESP32 devices
  through a 4-step setup wizard with QR scanning and captive-portal WiFi
  onboarding.
- **Live sensor dashboard** — differential pressure, temperature, humidity, CO₂
  and VOC readings rendered with Recharts (selectable time range, status chips).
- **Filter alerts** — per-device pressure threshold, configurable auto-order
  delay, in-app alert management page.
- **Email notifications** via Resend — device-offline alerts and auto-order
  confirmations with templated HTML.
- **Auto-replenishment** — Stripe Checkout for one-off orders plus a scheduled
  job that opens auto-orders when a filter alert ages past its grace window.
- **Public REST API (`/api/v1/*`)** — Bearer `sk_live_…` keys, managed under
  `/settings`.
- **Outbound webhooks** — HMAC-signed `filter.alert`, `device.offline`, and
  `reading.threshold` events with a delivery log.
- **OTA firmware updates** — `/api/ota/check` + `/api/ota/download` consumed by
  the `esp32-ota` PlatformIO environment.
- **CSV export** — download a device's full reading history.
- **Scheduled jobs** via Vercel Cron — device-offline sweep and auto-order
  processor.

## Stack

| Layer        | Tech                                                          |
|--------------|---------------------------------------------------------------|
| Framework    | Next.js 15 (App Router) + React 19                            |
| API          | tRPC 11 + TanStack Query, plus REST under `/api/*`            |
| Auth         | NextAuth v5 (Resend magic-link provider) + Prisma adapter     |
| DB           | PostgreSQL via Prisma 6                                       |
| Payments     | Stripe Checkout + webhooks                                    |
| Email        | Resend                                                        |
| Charts / UI  | Recharts, Tailwind v4                                         |
| Validation   | Zod, `@t3-oss/env-nextjs`                                     |
| Firmware     | ESP32 / PlatformIO (envs: `esp32-dev`, `-prod`, `-test`, `-ota`) |
| Hosting      | Vercel (Hobby plan — crons are daily)                         |

## Repository layout

```
src/
  app/
    api/
      auth/            NextAuth route handlers
      device/          ESP32 + dashboard device endpoints
      sensor/          Sensor ingest (POST)
      cron/            device-offline, auto-order
      ota/             check, download
      export/          CSV export
      store/           Stripe checkout + webhook
      user/            Account settings
      v1/devices/      Public REST API
      trpc/            tRPC handler
    dashboard/         Authenticated dashboard
    devices/           Device list + detail
    setup/             Device pairing wizard
    settings/          API keys, webhooks, notifications
    store/             Filter shop, orders, success
    signin/            Magic-link sign-in
  server/
    api/routers/       post, sensor, user, device, firmware, integrations
    auth/              NextAuth config + custom Prisma adapter
    db.ts              Prisma client singleton
  lib/                 energy, filter-alerts, filter-preference, api-key,
                       resend, stripe, stripe-client, webhooks
  trpc/                Client / server tRPC plumbing
prisma/
  schema.prisma        Device, SensorReading, FilterAlert, Order, …
  seed.ts              Seed data
esp32/
  platformio.ini       Multi-environment build config
  src/                 Firmware (captive portal, SDP810 driver, main)
```

## Local development

### Prerequisites

- Node 20+ (`package.json` pins `npm@10.9.2`)
- PostgreSQL 15+ — `./start-database.sh` spins up a Docker container
- A Resend account (for sign-in emails)
- A Stripe account (test mode works)

### Setup

```bash
git clone https://github.com/jeg5y7/MySmartFilter.git
cd MySmartFilter
cp .env.example .env          # fill in values, see below
./start-database.sh           # optional Docker postgres
npm install
npm run db:push               # apply Prisma schema
npm run db:seed               # optional seed data
npm run dev                   # http://localhost:3000
```

### Environment variables

Required for the app to boot:

| Variable          | Notes                              |
|-------------------|------------------------------------|
| `DATABASE_URL`    | Postgres connection string         |
| `AUTH_SECRET`     | `npx auth secret`                  |
| `RESEND_API_KEY`  | Magic-link sign-in + alert emails  |
| `EMAIL_FROM`      | e.g. `noreply@mysmartfilter.com`   |

Required for the store and scheduled jobs (all validated in `src/env.js`):

| Variable                                | Notes                                |
|-----------------------------------------|--------------------------------------|
| `STRIPE_SECRET_KEY`                     | Server-side Stripe                   |
| `STRIPE_WEBHOOK_SECRET`                 | Used by `/api/store/webhook`         |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`    | Client-side                          |
| `CRON_SECRET`                           | Bearer token Vercel sends to crons   |
| `NEXTAUTH_URL` / `AUTH_URL`             | Base URL for Stripe redirects        |

### Useful scripts

```bash
npm run dev          # next dev --turbo
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run check        # lint + typecheck
npm run db:push      # sync schema to DB
npm run db:generate  # prisma migrate dev
npm run db:migrate   # prisma migrate deploy
npm run db:studio    # Prisma Studio UI
npm run db:seed      # run prisma/seed.ts
```

## Firmware

The `esp32/` workspace uses PlatformIO. Select an environment per target:

```bash
cd esp32
pio run -e esp32-dev    # localhost:3000
pio run -e esp32-prod   # mysmartfilter.com
pio run -e esp32-test   # fake sensor data, no hardware
pio run -e esp32-ota    # OTA-capable build
```

The captive-portal flow lets a fresh device be configured from a phone with no
hardcoded credentials. After pairing, the device POSTs to `/api/sensor` using a
Bearer `sf_…` API token issued by `/api/device/register`.

See `esp32/PLATFORMIO_GUIDE.md` for hardware bring-up.

## Deployment

Built for Vercel:

1. Provision a Postgres database (Vercel Postgres / Neon / Supabase).
2. Add the env vars above in **Project Settings → Environment Variables**.
3. Configure a Stripe webhook pointing at `/api/store/webhook` and copy the
   signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Verify the Resend domain — see `RESEND_DNS_SETUP.md` and
   `VERCEL_DNS_RECORDS.md`.
5. Vercel reads `vercel.json` for the cron schedule.

## REST API v1

```
GET /api/v1/devices
Authorization: Bearer sk_live_<hex>
```

Manage keys at `/settings`. Each key tracks `lastUsed` for auditing.

Webhook payloads are signed with HMAC-SHA256:

```
X-SmartFilter-Event: filter.alert
X-SmartFilter-Signature: sha256=<HMAC of body using webhook.secret>
```

## Known issues / TODO

- Crons run daily (Vercel Hobby limit). Handlers are schedule-agnostic, but
  offline alerts and auto-orders can lag up to 24 h — upgrade to Pro and set
  `*/15` / hourly schedules before launch (see ROADMAP Phase 3).
- Auto-orders create `pending` orders but don't charge a card yet — off-session
  Stripe payment is ROADMAP Phase 2.
- Firmware doesn't yet send the `deviceSecret` on register; legacy devices are
  claimable by the first secret presenter (ratchet upgrade path).

## License

Private project — all rights reserved.
