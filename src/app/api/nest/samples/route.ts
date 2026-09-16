import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * GET /api/nest/samples?start=ISO&end=ISO — the signed-in user's indoor
 * humidity samples (pulled from their linked Nest), for the device-chart
 * indoor-vs-outdoor humidity overlay and for correlation analysis.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const start = new Date(searchParams.get("start") ?? Date.now() - 24 * 3600 * 1000);
  const end = new Date(searchParams.get("end") ?? Date.now());
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  try {
    const samples = await db.nestSample.findMany({
      where: {
        userId: session.user.id,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
      take: 10000,
      select: { timestamp: true, humidityPct: true },
    });
    return NextResponse.json({
      available: samples.length > 0,
      points: samples.map((s) => ({
        ts: s.timestamp.getTime(),
        humidityPct: s.humidityPct,
      })),
    });
  } catch {
    // Table not provisioned yet — no Nest ever connected.
    return NextResponse.json({ available: false, points: [] });
  }
}
