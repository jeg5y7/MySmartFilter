import { NextResponse } from "next/server";
import { db } from "~/server/db";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, type, firmware } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    // Check if device already exists
    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    if (existingDevice) {
      // Device already registered, return existing token
      return NextResponse.json({
        success: true,
        token: existingDevice.apiToken,
        message: "Device already registered",
      });
    }

    // Generate API token for device
    const apiToken = `sf_${crypto.randomBytes(32).toString('hex')}`;

    // Register new device (without userId - will be linked later)
    const newDevice = await db.device.create({
      data: {
        deviceId,
        apiToken,
        type: type || "SmartFilter",
        firmware: firmware || "1.0.0",
        status: "pending", // Pending until linked to user
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      token: apiToken,
      deviceId: newDevice.deviceId,
      message: "Device registered successfully",
    });
  } catch (error) {
    console.error("Error registering device:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    );
  }
}
