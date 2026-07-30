import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// GET: List all devices for authenticated user
export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all devices for the user
    const devices = await db.device.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        deviceId: true,
        name: true,
        location: true,
        type: true,
        firmware: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Add a status indicator for devices that haven't been seen in a while
    const devicesWithStatus = devices.map(device => {
      const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime();
      const isOnline = timeSinceLastSeen < 5 * 60 * 1000; // Consider online if seen in last 5 minutes
      
      return {
        ...device,
        isOnline,
        timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000), // in seconds
      };
    });

    return NextResponse.json({
      success: true,
      devices: devicesWithStatus,
      count: devices.length,
    });
  } catch (error) {
    console.error("Error listing devices:", error);
    return NextResponse.json(
      { error: "Failed to list devices" },
      { status: 500 }
    );
  }
}
