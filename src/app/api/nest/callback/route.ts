import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  nestConfigured,
  ensureNestTables,
  exchangeCode,
  encryptToken,
  listSdmDevices,
  pickThermostat,
  readTraits,
} from "~/lib/nest";

/**
 * GET /api/nest/callback — OAuth redirect target. Exchanges the code, finds
 * the user's thermostat (must expose the Humidity trait), stores the link
 * with an encrypted refresh token, and records an immediate first sample.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }

  const origin = env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const settingsUrl = (q: string) =>
    NextResponse.redirect(`${origin}/settings/integrations?nest=${q}`);

  if (!nestConfigured()) return settingsUrl("unconfigured");

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("nest_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return settingsUrl("error");
  }

  try {
    const redirectUri = `${origin}/api/nest/callback`;
    const { accessToken, refreshToken } = await exchangeCode(code, redirectUri);

    const devices = await listSdmDevices(accessToken);
    const thermostat = pickThermostat(devices);
    if (!thermostat) return settingsUrl("no-thermostat");

    const { humidityPct, tempC, hvacStatus } = readTraits(thermostat);

    await ensureNestTables();
    const now = new Date();
    await db.nestLink.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        sdmDeviceName: thermostat.name,
        refreshTokenEnc: encryptToken(refreshToken),
        lastHumidityPct: humidityPct,
        lastTempC: tempC,
        lastHvacStatus: hvacStatus,
        lastSyncAt: now,
      },
      update: {
        sdmDeviceName: thermostat.name,
        refreshTokenEnc: encryptToken(refreshToken),
        lastHumidityPct: humidityPct,
        lastTempC: tempC,
        lastHvacStatus: hvacStatus,
        lastSyncAt: now,
      },
    });
    if (humidityPct !== null) {
      await db.nestSample.create({
        data: { userId: session.user.id, humidityPct, tempC, hvacStatus },
      });
    }

    const res = settingsUrl("connected");
    res.cookies.delete("nest_oauth_state");
    return res;
  } catch (err) {
    console.error("[nest] callback failed:", err instanceof Error ? err.message : err);
    return settingsUrl("error");
  }
}
