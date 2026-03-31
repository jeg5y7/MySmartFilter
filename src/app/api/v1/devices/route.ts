import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "~/lib/api-key";
import { db } from "~/server/db";

/**
 * GET /api/v1/devices
 * Returns all devices owned by the authenticated user.
 * Auth: Bearer sk_live_...
 */
export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
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

  return NextResponse.json({
    data: devices.map((d) => ({
      id: d.deviceId,
      name: d.name,
      location: d.location,
      type: d.type,
      firmware: d.firmware,
      status: d.status,
      lastSeen: d.lastSeen,
      pressureThreshold: d.pressureThreshold,
      createdAt: d.createdAt,
      latestReading: d.sensorReadings[0]
        ? {
            pressure: d.sensorReadings[0].pressure,
            temperature: d.sensorReadings[0].temperature,
            timestamp: d.sensorReadings[0].timestamp,
          }
        : null,
    })),
  });
}
