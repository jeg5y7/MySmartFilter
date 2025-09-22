import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// GET: Get device details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { deviceId } = await params;

    // Get device details
    const device = await db.device.findUnique({
      where: { deviceId },
      include: {
        sensorReadings: {
          take: 10,
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Check if user owns the device
    if (device.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Calculate device online status
    const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime();
    const isOnline = timeSinceLastSeen < 5 * 60 * 1000; // Consider online if seen in last 5 minutes

    return NextResponse.json({
      success: true,
      device: {
        ...device,
        isOnline,
        timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000), // in seconds
      },
    });
  } catch (error) {
    console.error("Error getting device details:", error);
    return NextResponse.json(
      { error: "Failed to get device details" },
      { status: 500 }
    );
  }
}

// PUT: Update device details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { deviceId } = await params;
    const body = await request.json();
    const { name, location } = body;

    // Check if device exists and user owns it
    const device = await db.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    if (device.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Update device
    const updatedDevice = await db.device.update({
      where: { deviceId },
      data: {
        name: name !== undefined ? name : device.name,
        location: location !== undefined ? location : device.location,
      },
    });

    return NextResponse.json({
      success: true,
      device: updatedDevice,
      message: "Device updated successfully",
    });
  } catch (error) {
    console.error("Error updating device:", error);
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}

// DELETE: Delete device
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { deviceId } = await params;

    // Check if device exists and user owns it
    const device = await db.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    if (device.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete device (sensor readings will be kept but orphaned)
    await db.device.delete({
      where: { deviceId },
    });

    return NextResponse.json({
      success: true,
      message: "Device deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}
