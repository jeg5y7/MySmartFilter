# MySmartFilter — Claude Code context

IoT platform: ESP32 pressure sensors on HVAC filters + Next.js app (T3 stack).
Business: razor-and-blades — device at cost, revenue from filter auto-orders.
Target: public launch ~Oct 2026. **Read ROADMAP.md for the phased plan and
current status.** Progress dashboard artifact: "MySmartFilter · Launch Control".

## State (2026-07-30)

- Phases 0–2 shipped and merged to main via PR #2 (energy-cost model,
  Stripe off-session auto-order charging, /admin/orders queue, security fixes).
- DB schema already updated in production (user ran SQL in Neon console);
  Neon password rotated; Stripe webhook endpoint created fresh.
- **OPEN ISSUE 1: Vercel production deploy of main is FAILING.** Likely cause:
  src/env.js now hard-requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  CRON_SECRET, RESEND_API_KEY, AUTH_SECRET in production — one is probably
  missing/empty in Vercel env vars (check Preview scope too, not just
  Production). Get the build log via `VERCEL_TOKEN` + api.vercel.com, or ask
  the user to paste it. Old deployment is still serving.
- **OPEN ISSUE 2: Chrome shows "connection is not private" on
  mysmartfilter.com.** Unresolved — need the NET::ERR_* code from the user or
  direct probing (curl -vI) if network access allows. Certs are Vercel-managed;
  suspect domain/DNS config, unrelated to the code deploy.
- Next build work: ROADMAP Phase 3 (landing page, TOS/privacy, rate limiting,
  Vercel Pro crons, PWA), then Phase 4 hardware/firmware (device-secret in NVS).

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
