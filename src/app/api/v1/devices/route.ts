import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "~/lib/api-key";
import { db } from "~/server/db";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";
import { computeFilterHealth } from "~/lib/filter-health";
import { isAutoShipMember } from "~/lib/membership";

/**
 * GET /api/v1/devices
 * Returns all devices owned by the authenticated user, including the
 * filter-health summary consumed by smart-home integrations.
 * Auth: Bearer sk_live_...
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const rl = rateLimit(`v1:${authHeader ?? clientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  const userId = await validateApiKey(authHeader);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = await db.device.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      sensorReadings: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  // Tier gate: live data for everyone; the energy-model outputs are a
  // Filter AutoShip feature and are null for free accounts.
  const autoShip = await isAutoShipMember(userId);

  const data = await Promise.all(
    devices.map(async (d) => {
      const latest = d.sensorReadings[0] ?? null;
      const health = autoShip
        ? await computeFilterHealth(d, latest?.pressure ?? null)
        : null;
      return {
        id: d.deviceId,
        name: d.name,
        location: d.location,
        type: d.type,
        firmware: d.firmware,
        status: d.status,
        lastSeen: d.lastSeen,
        pressureThreshold: d.pressureThreshold,
        createdAt: d.createdAt,
        plan: autoShip ? "autoship" : "free",
        // Filter health (Filter AutoShip)
        filterLifePct: health?.lifePct ?? null,
        filterStatus: health?.status ?? null,
        blowerType: d.blowerType,
        runtimeHours: autoShip ? Math.round(d.runtimeHours * 10) / 10 : null,
        extraEnergyCostCents: autoShip ? Math.round(d.extraEnergyCostCents) : null,
        filterInstalledAt: d.filterInstalledAt,
        batteryPct: d.batteryPct,
        latestReading: latest
          ? {
              pressure: latest.pressure,
              temperature: latest.temperature,
              humidity: latest.humidity,
              timestamp: latest.timestamp,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ data });
}
