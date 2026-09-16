import { db } from "~/server/db";

/**
 * Outdoor weather for a device's install location.
 *
 * Location: geocoded ONCE from the owner's shipping address — US Census
 * Geocoder first (free, no key), Open-Meteo's geocoder as a ZIP-only
 * fallback — then stored rounded to 3 decimals (~110 m; weather grids are
 * 2–25 km, so this is already more precision than the data resolves).
 *
 * Weather: Open-Meteo forecast API with start_date/end_date (covers the
 * past ~92 days — plenty for the 30d chart view). Hourly temperature +
 * relative humidity, cached in-memory for 30 min per location/range.
 * Data is CC-BY 4.0 — the UI carries an Open-Meteo attribution line.
 */

export interface OutdoorPoint {
  /** UTC ms of the hour. */
  ts: number;
  tempF: number;
  rh: number;
}

const WEATHER_TTL_MS = 30 * 60 * 1000;
const weatherCache = new Map<string, { at: number; points: OutdoorPoint[] }>();

/** Open-Meteo's recent-history window for the forecast endpoint. */
export const MAX_PAST_DAYS = 90;

// ── Table self-provisioning (Waitlist pattern) ───────────────────────────────

export async function ensureDeviceLocationTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DeviceLocation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceLocation_pkey" PRIMARY KEY ("id")
  )`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "DeviceLocation_deviceId_key" ON "DeviceLocation"("deviceId")`
  );
}

// ── Geocoding ────────────────────────────────────────────────────────────────

async function censusGeocode(
  oneline: string
): Promise<{ lat: number; lon: number } | null> {
  try {
    const url =
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` +
      `?address=${encodeURIComponent(oneline)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { addressMatches?: { coordinates?: { x: number; y: number } }[] };
    };
    const coords = data.result?.addressMatches?.[0]?.coordinates;
    if (!coords) return null;
    return { lat: coords.y, lon: coords.x };
  } catch {
    return null;
  }
}

async function zipGeocode(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(zip)}&count=1&language=en&format=json&countryCode=US`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { latitude: number; longitude: number }[];
    };
    const hit = data.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude };
  } catch {
    return null;
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Returns the device's stored location, geocoding and storing it on first
 * use. Null when the owner has no usable shipping address yet.
 */
export async function getOrCreateDeviceLocation(
  deviceId: string,
  userId: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const existing = await db.deviceLocation.findUnique({ where: { deviceId } });
    if (existing) return existing;
  } catch {
    await ensureDeviceLocationTable();
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      shippingAddress1: true,
      shippingCity: true,
      shippingState: true,
      shippingZip: true,
    },
  });
  if (!user) return null;

  let coords: { lat: number; lon: number } | null = null;
  let source = "census";
  if (user.shippingAddress1 && user.shippingCity && user.shippingState) {
    const oneline = [
      user.shippingAddress1,
      user.shippingCity,
      user.shippingState,
      user.shippingZip ?? "",
    ]
      .filter(Boolean)
      .join(", ");
    coords = await censusGeocode(oneline);
  }
  if (!coords && user.shippingZip) {
    coords = await zipGeocode(user.shippingZip);
    source = "zip";
  }
  if (!coords) return null;

  const latitude = round3(coords.lat);
  const longitude = round3(coords.lon);
  try {
    await ensureDeviceLocationTable();
    await db.deviceLocation.upsert({
      where: { deviceId },
      create: { deviceId, latitude, longitude, source },
      update: { latitude, longitude, source },
    });
  } catch (err) {
    console.error("[weather] failed to store device location:", err);
  }
  return { latitude, longitude };
}

// ── Outdoor hourly fetch ─────────────────────────────────────────────────────

export async function fetchOutdoorHourly(
  latitude: number,
  longitude: number,
  start: Date,
  end: Date
): Promise<OutdoorPoint[]> {
  const clampMs = MAX_PAST_DAYS * 24 * 3600 * 1000;
  const now = Date.now();
  const startMs = Math.max(start.getTime(), now - clampMs);
  const endMs = Math.min(end.getTime(), now + 24 * 3600 * 1000);
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(endMs).toISOString().slice(0, 10);

  const key = `${latitude},${longitude},${startDate},${endDate}`;
  const cached = weatherCache.get(key);
  if (cached && now - cached.at < WEATHER_TTL_MS) return cached.points;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=temperature_2m,relative_humidity_2m` +
    `&temperature_unit=fahrenheit&timezone=UTC` +
    `&start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: (number | null)[];
      relative_humidity_2m: (number | null)[];
    };
  };
  const h = data.hourly;
  if (!h) return [];

  const points: OutdoorPoint[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const tempF = h.temperature_2m[i];
    const rh = h.relative_humidity_2m[i];
    if (tempF == null || rh == null) continue; // future hours beyond forecast
    points.push({ ts: Date.parse(`${h.time[i]}:00Z`), tempF, rh });
  }
  weatherCache.set(key, { at: now, points });
  return points;
}
