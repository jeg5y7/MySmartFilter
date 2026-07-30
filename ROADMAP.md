# MySmartFilter — Launch Roadmap

**Goal:** public launch in ~3 months.
**Business model:** razor-and-blades — device at/near cost, recurring revenue
from filter sales driven by energy-cost-based auto-ordering.
**Fulfillment (launch):** manual dropship from an admin order queue.

## Phase 0 — Production blockers ✅

- [x] Delete unauthenticated `GET /api/sensor` and `/api/debug-env`
- [x] Validate Stripe/cron env vars through `src/env.js`
- [x] Remove public `sensor.create` tRPC mutation (unauthenticated write)
- [x] `/api/device/register` token leak — device-secret handshake
  (firmware presents a self-generated secret to re-fetch its token)
- [x] Offline sweep made schedule-agnostic (works on daily Hobby cron)
- [x] Fix filter-preference resolution (device-specific → user default)

## Phase 1 — Energy-cost model ✅

The core product promise: replace the filter when the extra electricity it
burns exceeds the price of a new one.

- [x] `src/lib/energy.ts` — physics: `extraWatts = ΔP_rise × airflow / η`,
  blower runtime detected from ΔP > 5 Pa (pressure is ~0 when the blower is off)
- [x] Per-reading accrual of runtime + extra cost on ingest
- [x] Clean-filter baseline auto-captured on first blower-on reading
- [x] Energy-cost alert → email → 24 h grace → auto-order (ECM systems;
  PSC systems fall back to the pressure threshold — physics doesn't support
  an energy claim there)
- [x] HVAC settings UI (blower type, airflow CFM, electricity rate)
- [x] Filter Health card with cost-vs-price progress meter
- [x] "I replaced my filter" reset flow

**Deploy note:** run `npm run db:push` (or a migration) — `Device` gained
`deviceSecretHash`, `blowerType`, `airflowCfm`, `electricityRateCents`,
`baselineDeltaP`, `filterInstalledAt`, `runtimeHours`,
`extraEnergyCostCents`, `lastAccrualAt`.

## Phase 2 — Money movement ✅

- [x] Saved payment methods: checkout saves the card
  (`setup_future_usage: off_session`), `/settings/billing` adds one without a
  purchase (setup-mode Checkout), webhook stores the payment method
- [x] Off-session PaymentIntent in the auto-order cron — auto-orders charge
  the card on file; declined cards → `payment_failed` + fix-it email
- [x] Shipping address on file (auto-captured from checkout, editable at
  `/settings/billing`)
- [x] Admin role + `/admin/orders` queue: ready-to-ship list with items/SKU +
  address, mark-shipped with tracking → customer email
  (`npx tsx scripts/make-admin.ts <email>` grants access)
- [x] One-click tokenized cancel link in alert emails (`/api/alert/cancel`)

**Deploy note:** `npm run db:push` again — `User` gained billing/shipping
columns, `Order` gained tracking fields, `FilterAlert` gained `cancelToken`.
Also removed the committed `.env.production` — **rotate the Neon database
password and Stripe webhook secret**, both were in git history.

## Phase 3 — Launch surface

- [ ] Landing page with product story + buy flow (device purchase SKU in store)
- [ ] Terms of Service + Privacy Policy pages
- [ ] Rate limiting on public endpoints (`/api/sensor`, `/api/device/register`,
  `/api/v1/*`) — Upstash or in-DB token bucket
- [ ] Vercel Pro + crons back to `*/15` (offline sweep) and hourly (auto-order)
- [ ] PWA manifest + icons so the dashboard installs on phones (native app later)
- [ ] Onboarding email sequence (welcome, install guide, first-alert explainer)

## Phase 4 — Hardware launch checklist

Software side can spec; physical work is on the founder:

- [ ] Lock BOM: ESP32 module (pre-certified, e.g. ESP32-WROOM-32E) + Sensirion
  SDP810-500 + enclosure + tubing/ports
- [ ] Firmware: ship the device-secret handshake (generate on first boot,
  store in NVS, send on `/api/device/register`)
- [ ] QR label workflow: deviceId printed at flash time, QR resolves to
  `mysmartfilter.com/setup?device=<id>`
- [ ] FCC: unintentional-radiator route using the module's modular cert
- [ ] Install kit: filter-slot mounting, upstream/downstream pressure taps
- [ ] Pilot batch (~25 units) before public sale

## Later / ideas

- HVAC troubleshooting insights (short-cycling detection from runtime patterns,
  frozen-coil signature: rising ΔP with falling supply temperature)
- Native mobile app (React Native/Expo) once PWA outgrows itself
- Distributor/3PL integration when manual dropship exceeds ~50 orders/mo
- Multi-tenant / property-manager accounts (many devices, one payer)
