import { db } from "~/server/db";
import { computeFilterHealth } from "~/lib/filter-health";
import { isAutoShipMember } from "~/lib/membership";

/**
 * Normalized device shape consumed by the smart-home connectors
 * (Google fulfillment, Alexa lambda, SmartThings schema).
 * Same tier rules as /api/v1/devices: live data for everyone,
 * filter-health outputs only for Filter AutoShip members.
 */
export interface BridgeDevice {
  id: string; // public deviceId (SF…)
  name: string;
  online: boolean;
  plan: "autoship" | "free";
  filterLifePct: number | null; // 100 = fresh, 0 = replace (autoship only)
  filterStatus: "ok" | "replace_soon" | "replace_now" | null;
  pressurePa: number | null;
  temperatureC: number | null;
  batteryPct: number | null;
}

const OFFLINE_AFTER_MISSED_CHECKINS = 3;

export async function getBridgeDevices(userId: string): Promise<BridgeDevice[]> {
  const [devices, autoShip] = await Promise.all([
    db.device.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        sensorReadings: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    }),
    isAutoShipMember(userId),
  ]);

  const now = Date.now();
  return Promise.all(
    devices.map(async (d) => {
      const latest = d.sensorReadings[0] ?? null;
      const health = autoShip
        ? await computeFilterHealth(d, latest?.pressure ?? null)
        : null;
      const offlineAfterMs =
        d.reportingIntervalMin * OFFLINE_AFTER_MISSED_CHECKINS * 60 * 1000;
      return {
        id: d.deviceId,
        name: d.name ?? d.deviceId,
        online: now - new Date(d.lastSeen).getTime() < offlineAfterMs,
        plan: autoShip ? ("autoship" as const) : ("free" as const),
        filterLifePct: health?.lifePct ?? null,
        filterStatus: health?.status ?? null,
        pressurePa: latest?.pressure ?? null,
        temperatureC: latest?.temperature ?? null,
        batteryPct: d.batteryPct,
      };
    })
  );
}
