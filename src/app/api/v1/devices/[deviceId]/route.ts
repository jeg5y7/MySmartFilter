import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "~/lib/api-key";
import { db } from "~/server/db";

interface Params {
  params: Promise<{ deviceId: string }>;
}

/**
 * GET /api/v1/devices/:deviceId
 * Returns device details + latest reading.
 * Auth: Bearer sk_live_...
 */
export async function GET(req: NextRequest, { params }: Params) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deviceId } = await params;

  const device = await db.device.findFirst({
    where: { deviceId, userId },
    include: {
      sensorReadings: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: device.deviceId,
      name: device.name,
      location: device.location,
      type: device.type,
      firmware: device.firmware,
      status: device.status,
      lastSeen: device.lastSeen,
      pressureThreshold: device.pressureThreshold,
      createdAt: device.createdAt,
      latestReading: device.sensorReadings[0]
        ? {
            pressure: device.sensorReadings[0].pressure,
            temperature: device.sensorReadings[0].temperature,
            timestamp: device.sensorReadings[0].timestamp,
          }
        : null,
    },
  });
}
