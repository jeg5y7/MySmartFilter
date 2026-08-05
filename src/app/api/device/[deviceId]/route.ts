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

    // Get device details (deviceId param is the cuid Device.id)
    const device = await db.device.findFirst({
      where: { id: deviceId, userId: session.user.id },
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
    const body = await request.json() as {
      name?: string;
      location?: string | null;
      pressureThreshold?: number;
      blowerType?: string;
      airflowCfm?: number;
      electricityRateCents?: number;
      furnaceMake?: string | null;
      furnaceModel?: string | null;
    };
    const {
      name,
      location,
      pressureThreshold,
      blowerType,
      airflowCfm,
      electricityRateCents,
      furnaceMake,
      furnaceModel,
    } = body;

    // Check if device exists and user owns it (deviceId param is the cuid Device.id)
    const device = await db.device.findFirst({
      where: { id: deviceId, userId: session.user.id },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Validate pressureThreshold if provided
    if (
      pressureThreshold !== undefined &&
      (typeof pressureThreshold !== "number" ||
        pressureThreshold < 50 ||
        pressureThreshold > 500)
    ) {
      return NextResponse.json(
        { error: "Pressure threshold must be between 50 and 500 Pa" },
        { status: 400 }
      );
    }

    // Validate HVAC/energy settings if provided
    if (blowerType !== undefined && !["ecm", "psc"].includes(blowerType)) {
      return NextResponse.json(
        { error: "blowerType must be 'ecm' or 'psc'" },
        { status: 400 }
      );
    }
    if (
      airflowCfm !== undefined &&
      (typeof airflowCfm !== "number" || airflowCfm < 100 || airflowCfm > 5000)
    ) {
      return NextResponse.json(
        { error: "airflowCfm must be between 100 and 5000" },
        { status: 400 }
      );
    }
    if (
      electricityRateCents !== undefined &&
      (typeof electricityRateCents !== "number" ||
        electricityRateCents < 1 ||
        electricityRateCents > 100)
    ) {
      return NextResponse.json(
        { error: "electricityRateCents must be between 1 and 100 ¢/kWh" },
        { status: 400 }
      );
    }
    for (const [field, value] of [
      ["furnaceMake", furnaceMake],
      ["furnaceModel", furnaceModel],
    ] as const) {
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== "string" || value.length > 80)
      ) {
        return NextResponse.json(
          { error: `${field} must be a string of at most 80 characters` },
          { status: 400 }
        );
      }
    }

    // Update device
    const updatedDevice = await db.device.update({
      where: { id: deviceId },
      data: {
        name: name !== undefined ? name : device.name,
        location: location !== undefined ? location : device.location,
        pressureThreshold:
          pressureThreshold !== undefined ? pressureThreshold : device.pressureThreshold,
        ...(blowerType !== undefined && { blowerType }),
        ...(airflowCfm !== undefined && { airflowCfm }),
        ...(electricityRateCents !== undefined && { electricityRateCents }),
        ...(furnaceMake !== undefined && {
          furnaceMake: furnaceMake?.trim() ? furnaceMake.trim() : null,
        }),
        ...(furnaceModel !== undefined && {
          furnaceModel: furnaceModel?.trim() ? furnaceModel.trim() : null,
        }),
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

    // Check if device exists and user owns it (deviceId param is the cuid Device.id)
    const device = await db.device.findFirst({
      where: { id: deviceId, userId: session.user.id },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Delete device (sensor readings will be kept but orphaned)
    await db.device.delete({
      where: { id: deviceId },
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
