import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// GET: Poll device status (called by setup wizard during captive portal step)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId query parameter is required" },
        { status: 400 }
      );
    }

    let authorized = false;

    // Auth option 1: Bearer token = provisioning sessionToken
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const provSession = await db.provisioningSession.findUnique({
        where: { sessionToken: token },
      });
      if (
        provSession &&
        provSession.deviceId === deviceId &&
        new Date() < provSession.expiresAt
      ) {
        authorized = true;
      }
    }

    // Auth option 2: logged-in user who owns the device
    if (!authorized) {
      const session = await auth();
      if (session?.user?.id) {
        const device = await db.device.findUnique({ where: { deviceId } });
        if (device?.userId === session.user.id) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const device = await db.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, status: true, lastSeen: true },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deviceId: device.deviceId,
      status: device.status,
      lastSeen: device.lastSeen,
    });
  } catch (error) {
    console.error("Error fetching device status:", error);
    return NextResponse.json(
      { error: "Failed to fetch device status" },
      { status: 500 }
    );
  }
}

// PUT: Update device status (called by device)
export async function PUT(request: Request) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.substring(7);

    // Find device by API token
    const device = await db.device.findUnique({
      where: { apiToken },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Invalid API token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, firmware } = body;

    // Update device status and last seen time
    const updatedDevice = await db.device.update({
      where: { id: device.id },
      data: {
        status: status || device.status,
        firmware: firmware || device.firmware,
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      device: {
        deviceId: updatedDevice.deviceId,
        status: updatedDevice.status,
        firmware: updatedDevice.firmware,
        lastSeen: updatedDevice.lastSeen,
      },
    });
  } catch (error) {
    console.error("Error updating device status:", error);
    return NextResponse.json(
      { error: "Failed to update device status" },
      { status: 500 }
    );
  }
}
