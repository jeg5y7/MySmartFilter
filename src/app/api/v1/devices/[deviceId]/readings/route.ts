import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "~/lib/api-key";
import { db } from "~/server/db";

interface Params {
  params: Promise<{ deviceId: string }>;
}

/**
 * GET /api/v1/devices/:deviceId/readings
 * Query params:
 *   limit  — max results (default 50, max 500)
 *   cursor — ISO timestamp for pagination (before this timestamp)
 *   startDate, endDate — ISO date filters
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
    select: { id: true, deviceId: true },
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const { searchParams } = req.nextUrl;
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 500);
  const cursor = searchParams.get("cursor");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;
  const cursorDate = cursor ? new Date(cursor) : undefined;

  const readings = await db.sensorReading.findMany({
    where: {
      deviceId: device.deviceId,
      userId,
      ...((startDate ?? endDate ?? cursorDate) ? {
        timestamp: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
          ...(cursorDate && { lt: cursorDate }),
        },
      } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: limit + 1,
    select: {
      pressure: true,
      temperature: true,
      timestamp: true,
    },
  });

  const hasMore = readings.length > limit;
  const rows = hasMore ? readings.slice(0, limit) : readings;
  const nextCursor = hasMore ? rows[rows.length - 1]?.timestamp.toISOString() : null;

  return NextResponse.json({
    data: rows.map((r) => ({
      pressure: r.pressure,
      temperature: r.temperature,
      timestamp: r.timestamp,
    })),
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  });
}
