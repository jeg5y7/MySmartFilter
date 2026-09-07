import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { nestConfigured } from "~/lib/nest";

/** GET /api/nest — link status for the Integrations page. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!nestConfigured()) {
    return NextResponse.json({ configured: false, linked: false });
  }
  try {
    const link = await db.nestLink.findUnique({
      where: { userId: session.user.id },
      select: {
        lastHumidityPct: true,
        lastTempC: true,
        lastHvacStatus: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ configured: true, linked: Boolean(link), link });
  } catch {
    // Table not provisioned yet — nobody has connected.
    return NextResponse.json({ configured: true, linked: false, link: null });
  }
}

/** DELETE /api/nest — disconnect (removes the link + stored token; samples
 *  are kept for analysis). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await db.nestLink.deleteMany({ where: { userId: session.user.id } });
  } catch {
    // Table missing = nothing to disconnect.
  }
  return NextResponse.json({ ok: true });
}
