import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getOrCreateDeviceLocation, fetchOutdoorHourly } from "~/lib/weather";

interface Params {
  params: Promise<{ deviceId: string }>;
}

/**
 * GET /api/device/:id/weather?start=ISO&end=ISO
 * Outdoor hourly temperature (°F) + relative humidity (%) for the device's
 * geocoded install location. `id` accepts either the Device cuid or the
 * SF… device code. Owner-only.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deviceId: idParam } = await params;
  const device = await db.device.findFirst({
    where: { userId: session.user.id, OR: [{ id: idParam }, { deviceId: idParam }] },
    select: { deviceId: true },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const { searchParams } = req.nextUrl;
  const start = new Date(searchParams.get("start") ?? Date.now() - 24 * 3600 * 1000);
  const end = new Date(searchParams.get("end") ?? Date.now());
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  const location = await getOrCreateDeviceLocation(device.deviceId, session.user.id);
  if (!location) {
    return NextResponse.json({ available: false, reason: "no-address" });
  }

  try {
    const points = await fetchOutdoorHourly(
      location.latitude,
      location.longitude,
      start,
      end
    );
    return NextResponse.json({ available: true, points });
  } catch (err) {
    console.error("[weather] fetch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ available: false, reason: "fetch-failed" });
  }
}
