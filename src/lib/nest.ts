import crypto from "crypto";
import { db } from "~/server/db";
import { env } from "~/env";

/**
 * Google Nest sandbox integration (Smart Device Management API).
 *
 * Purpose: pull indoor humidity (+ thermostat state) from a customer's Nest
 * so we can correlate coil wetness (within-run ΔP sag) with latent load.
 * Sandbox tier: 25 users / 5 homes — a pilot instrument, not a launch
 * dependency; Rev B ships its own RH chip (see ROADMAP.md).
 *
 * Auth model: per-user OAuth against the founder's Device Access project.
 * The refresh token is stored AES-256-GCM encrypted; access tokens live only
 * in memory. Setup steps for the Google side: docs/NEST_SANDBOX.md.
 */

const SDM_SCOPE = "https://www.googleapis.com/auth/sdm.service";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";

/** Minimum gap between polls per user (SDM sandbox allows far more; 5 min is
 *  plenty for humidity, which moves on furnace-cycle timescales). */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function nestConfigured(): boolean {
  return Boolean(
    env.NEST_SDM_PROJECT_ID && env.NEST_OAUTH_CLIENT_ID && env.NEST_OAUTH_CLIENT_SECRET
  );
}

export function nestAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    access_type: "offline",
    prompt: "consent",
    client_id: env.NEST_OAUTH_CLIENT_ID!,
    response_type: "code",
    scope: SDM_SCOPE,
    state,
  });
  // SDM uses the Partner Connections consent flow, keyed by the Device
  // Access project id (NOT accounts.google.com directly).
  return `https://nestservices.google.com/partnerconnections/${env.NEST_SDM_PROJECT_ID}/auth?${params.toString()}`;
}

// ── Token crypto ─────────────────────────────────────────────────────────────

function tokenKey(): Buffer {
  const secret = env.AUTH_SECRET ?? "dev-secret";
  return crypto.createHash("sha256").update(`${secret}:nest-token-v1`).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed stored token");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    tokenKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Table self-provisioning (same pattern as Waitlist) ───────────────────────

export async function ensureNestTables() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "NestLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sdmDeviceName" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "lastHumidityPct" DOUBLE PRECISION,
    "lastTempC" DOUBLE PRECISION,
    "lastHvacStatus" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NestLink_pkey" PRIMARY KEY ("id")
  )`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "NestLink_userId_key" ON "NestLink"("userId")`
  );
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "NestSample" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "humidityPct" DOUBLE PRECISION NOT NULL,
    "tempC" DOUBLE PRECISION,
    "hvacStatus" TEXT,
    CONSTRAINT "NestSample_pkey" PRIMARY KEY ("id")
  )`);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "NestSample_userId_timestamp_idx" ON "NestSample"("userId", "timestamp")`
  );
}

// ── OAuth exchange / refresh ─────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.NEST_OAUTH_CLIENT_ID!,
      client_secret: env.NEST_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(`Nest token exchange failed: ${data.error ?? res.status}`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.NEST_OAUTH_CLIENT_ID!,
      client_secret: env.NEST_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Nest token refresh failed: ${data.error ?? res.status}`);
  }
  return data.access_token;
}

// ── SDM devices ──────────────────────────────────────────────────────────────

interface SdmDevice {
  name: string;
  type: string;
  traits?: Record<string, Record<string, unknown>>;
  parentRelations?: { displayName?: string }[];
}

export async function listSdmDevices(accessToken: string): Promise<SdmDevice[]> {
  const res = await fetch(
    `${SDM_BASE}/enterprises/${env.NEST_SDM_PROJECT_ID}/devices`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`SDM device list failed: ${res.status}`);
  const data = (await res.json()) as { devices?: SdmDevice[] };
  return data.devices ?? [];
}

export function pickThermostat(devices: SdmDevice[]): SdmDevice | null {
  return (
    devices.find(
      (d) =>
        d.type === "sdm.devices.types.THERMOSTAT" &&
        d.traits?.["sdm.devices.traits.Humidity"] !== undefined
    ) ?? null
  );
}

export function readTraits(device: SdmDevice): {
  humidityPct: number | null;
  tempC: number | null;
  hvacStatus: string | null;
} {
  const t = device.traits ?? {};
  const humidity = t["sdm.devices.traits.Humidity"]?.ambientHumidityPercent;
  const temp = t["sdm.devices.traits.Temperature"]?.ambientTemperatureCelsius;
  const hvac = t["sdm.devices.traits.ThermostatHvac"]?.status;
  return {
    humidityPct: typeof humidity === "number" ? humidity : null,
    tempC: typeof temp === "number" ? temp : null,
    hvacStatus: typeof hvac === "string" ? hvac : null,
  };
}

// ── Poll-on-ingest ───────────────────────────────────────────────────────────
// Vercel Hobby crons are daily-only, but the monitor phones home every ~30 s —
// so sensor ingestion opportunistically triggers a Nest poll, debounced to
// every POLL_INTERVAL_MS per user. Failures never affect ingestion.

/** Per-instance debounce so hot ingestion paths skip even the DB lookup. */
const lastAttemptAt = new Map<string, number>();

export async function maybePollNest(userId: string): Promise<void> {
  if (!nestConfigured()) return;
  const now = Date.now();
  const last = lastAttemptAt.get(userId) ?? 0;
  if (now - last < POLL_INTERVAL_MS) return;
  lastAttemptAt.set(userId, now);

  try {
    const link = await db.nestLink.findUnique({ where: { userId } });
    if (!link) return;
    if (link.lastSyncAt && now - link.lastSyncAt.getTime() < POLL_INTERVAL_MS) {
      return;
    }

    const accessToken = await refreshAccessToken(decryptToken(link.refreshTokenEnc));
    const devices = await listSdmDevices(accessToken);
    const thermostat =
      devices.find((d) => d.name === link.sdmDeviceName) ?? pickThermostat(devices);
    if (!thermostat) return;

    const { humidityPct, tempC, hvacStatus } = readTraits(thermostat);
    if (humidityPct === null) return;

    await db.$transaction([
      db.nestSample.create({
        data: { userId, humidityPct, tempC, hvacStatus },
      }),
      db.nestLink.update({
        where: { userId },
        data: {
          lastHumidityPct: humidityPct,
          lastTempC: tempC,
          lastHvacStatus: hvacStatus,
          lastSyncAt: new Date(),
        },
      }),
    ]);
  } catch (err) {
    // Table may not exist yet on first prod use — provision and let the next
    // ingest retry; any other failure is logged and swallowed.
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist/i.test(msg)) {
      try {
        await ensureNestTables();
      } catch {
        /* next attempt will retry */
      }
    }
    console.error(`[nest] poll failed for user ${userId}:`, msg);
  }
}
