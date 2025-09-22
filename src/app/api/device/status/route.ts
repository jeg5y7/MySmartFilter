import { NextResponse } from "next/server";
import { db } from "~/server/db";

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
