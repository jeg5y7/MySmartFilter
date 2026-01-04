import { NextResponse } from "next/server";
import { db } from "~/server/db";

interface AlertRequest {
  deviceId: string;
  apiToken: string;
  pressure: number;
}

// ESP32 calls this when differential pressure exceeds threshold
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AlertRequest;
    const { deviceId, apiToken, pressure } = body;

    if (!deviceId || !apiToken || pressure === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: deviceId, apiToken, pressure" },
        { status: 400 }
      );
    }

    // Verify device and get user
    const device = await db.device.findUnique({
      where: { deviceId },
      include: { user: true },
    });

    if (!device || device.apiToken !== apiToken) {
      return NextResponse.json({ error: "Invalid device credentials" }, { status: 401 });
    }

    if (!device.userId || !device.user) {
      return NextResponse.json(
        { error: "Device not linked to a user account" },
        { status: 400 }
      );
    }

    // Check if pressure exceeds threshold
    if (pressure < device.pressureThreshold) {
      return NextResponse.json({
        alert: false,
        message: "Pressure within normal range",
        pressure,
        threshold: device.pressureThreshold,
      });
    }

    // Check for existing pending alert (avoid duplicates)
    const existingAlert = await db.filterAlert.findFirst({
      where: {
        deviceId: device.id,
        status: { in: ["pending", "notified"] },
      },
    });

    if (existingAlert) {
      return NextResponse.json({
        alert: true,
        message: "Alert already exists",
        alertId: existingAlert.id,
        status: existingAlert.status,
      });
    }

    // Check user's auto-order preference for this device
    const preference = await db.userFilterPreference.findFirst({
      where: {
        userId: device.userId,
        OR: [
          { deviceId: device.id }, // Device-specific preference
          { deviceId: null }, // Default preference
        ],
      },
      orderBy: { deviceId: "desc" }, // Prefer device-specific over default
    });

    const autoOrderEnabled = preference?.autoOrderEnabled ?? false;

    // Calculate auto-order time (24 hours from now if enabled)
    const autoOrderAt = autoOrderEnabled
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;

    // Create filter alert
    const alert = await db.filterAlert.create({
      data: {
        deviceId: device.id,
        userId: device.userId,
        pressure,
        threshold: device.pressureThreshold,
        status: "pending",
        autoOrderAt,
      },
    });

    // TODO: Send email notification to user
    // This would use Resend/nodemailer to notify the user
    // For now, we'll just log it
    console.log(`Filter alert created for user ${device.user.email}:`, {
      alertId: alert.id,
      deviceName: device.name ?? device.deviceId,
      pressure,
      threshold: device.pressureThreshold,
      autoOrderEnabled,
      autoOrderAt,
    });

    // Update alert status to notified
    await db.filterAlert.update({
      where: { id: alert.id },
      data: { status: "notified", notifiedAt: new Date() },
    });

    return NextResponse.json({
      alert: true,
      alertId: alert.id,
      message: "Filter replacement alert created",
      autoOrderEnabled,
      autoOrderAt: autoOrderAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Filter alert error:", error);
    return NextResponse.json(
      { error: "Failed to process filter alert" },
      { status: 500 }
    );
  }
}

// Get pending alerts for a device
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const apiToken = url.searchParams.get("apiToken");

  if (!deviceId || !apiToken) {
    return NextResponse.json(
      { error: "Missing deviceId or apiToken" },
      { status: 400 }
    );
  }

  const device = await db.device.findUnique({
    where: { deviceId },
  });

  if (!device || device.apiToken !== apiToken) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const alerts = await db.filterAlert.findMany({
    where: {
      deviceId: device.id,
      status: { in: ["pending", "notified"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ alerts });
}
