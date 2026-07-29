import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * POST /api/device/[deviceId]/filter-replaced
 *
 * User marks the filter as replaced. Resets the energy-cost accumulators and
 * clears the baseline — the next blower-on reading re-captures it against the
 * fresh filter. Also resolves any open alerts for the device.
 * (deviceId param is the cuid Device.id.)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { deviceId } = await params;

    const device = await db.device.findFirst({
      where: { id: deviceId, userId: session.user.id },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const now = new Date();

    await db.$transaction([
      db.device.update({
        where: { id: device.id },
        data: {
          baselineDeltaP: null,
          filterInstalledAt: now,
          runtimeHours: 0,
          extraEnergyCostCents: 0,
          lastAccrualAt: null,
        },
      }),
      db.filterAlert.updateMany({
        where: {
          deviceId: device.id,
          status: { in: ["pending", "notified"] },
        },
        data: { status: "dismissed", resolvedAt: now },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Filter marked as replaced — tracking reset",
    });
  } catch (error) {
    console.error("Error marking filter replaced:", error);
    return NextResponse.json(
      { error: "Failed to mark filter replaced" },
      { status: 500 }
    );
  }
}
