import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { isAutoShipMember } from "~/lib/membership";

const MAX_ROWS = 10000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Historical export is a Filter AutoShip feature
  if (!(await isAutoShipMember(session.user.id))) {
    return NextResponse.json(
      {
        error:
          "CSV export of history is included with Filter AutoShip. Enable Auto-Order on a filter preference to unlock it.",
      },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const deviceId = searchParams.get("deviceId") ?? undefined;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Validate dates if provided
  if (startDate && isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }
  if (endDate && isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
  }

  // If deviceId provided, verify it belongs to the user
  if (deviceId) {
    const device = await db.device.findFirst({
      where: { deviceId, userId: session.user.id },
    });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
  }

  const readings = await db.sensorReading.findMany({
    where: {
      userId: session.user.id,
      ...(deviceId && { deviceId }),
      ...((startDate ?? endDate) ? {
        timestamp: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      } : {}),
    },
    orderBy: { timestamp: "asc" },
    take: MAX_ROWS + 1,
    include: { device: { select: { name: true, deviceId: true } } },
  });

  const truncated = readings.length > MAX_ROWS;
  const rows = truncated ? readings.slice(0, MAX_ROWS) : readings;

  // Build CSV
  const lines: string[] = [];

  if (truncated) {
    lines.push(`# Note: Export truncated to ${MAX_ROWS} rows. Use date filters to narrow your range.`);
  }

  lines.push("timestamp,device_id,device_name,pressure_pa,temperature_c");

  for (const r of rows) {
    const deviceName = (r.device.name ?? r.device.deviceId).replace(/"/g, '""');
    lines.push(
      `${r.timestamp.toISOString()},${r.device.deviceId},"${deviceName}",${r.pressure.toFixed(2)},${r.temperature.toFixed(2)}`
    );
  }

  const csv = lines.join("\n") + "\n";
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `smartfilter-readings-${dateStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
