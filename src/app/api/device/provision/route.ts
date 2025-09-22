import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import crypto from "crypto";

// POST: Create a new provisioning session
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    // Check if device exists and is not already linked
    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    if (existingDevice?.userId && existingDevice.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Device is already linked to another account" },
        { status: 409 }
      );
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Create provisioning session (expires in 10 minutes)
    const provisioningSession = await db.provisioningSession.create({
      data: {
        deviceId,
        sessionToken,
        userId: session.user.id,
        status: "pending",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresAt: provisioningSession.expiresAt,
      message: "Provisioning session created",
    });
  } catch (error) {
    console.error("Error creating provisioning session:", error);
    return NextResponse.json(
      { error: "Failed to create provisioning session" },
      { status: 500 }
    );
  }
}

// PUT: Complete provisioning session
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, deviceName, location } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session token is required" },
        { status: 400 }
      );
    }

    // Find provisioning session
    const provisioningSession = await db.provisioningSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!provisioningSession) {
      return NextResponse.json(
        { error: "Invalid session token" },
        { status: 404 }
      );
    }

    // Check if session has expired
    if (new Date() > provisioningSession.expiresAt) {
      // Mark session as expired
      await db.provisioningSession.update({
        where: { id: provisioningSession.id },
        data: { status: "expired" },
      });

      return NextResponse.json(
        { error: "Provisioning session has expired" },
        { status: 410 }
      );
    }

    // Check if session is already completed
    if (provisioningSession.status === "completed") {
      return NextResponse.json(
        { error: "Provisioning session already completed" },
        { status: 409 }
      );
    }

    // Update or create device
    const device = await db.device.upsert({
      where: { deviceId: provisioningSession.deviceId },
      update: {
        userId: provisioningSession.userId,
        name: deviceName || `Device ${provisioningSession.deviceId}`,
        location,
        status: "active",
        lastSeen: new Date(),
      },
      create: {
        deviceId: provisioningSession.deviceId,
        userId: provisioningSession.userId,
        name: deviceName || `Device ${provisioningSession.deviceId}`,
        location,
        apiToken: `sf_${crypto.randomBytes(32).toString('hex')}`,
        type: "SmartFilter",
        status: "active",
        lastSeen: new Date(),
      },
    });

    // Mark provisioning session as completed
    await db.provisioningSession.update({
      where: { id: provisioningSession.id },
      data: { status: "completed" },
    });

    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        name: device.name,
        location: device.location,
        status: device.status,
      },
      message: "Device provisioned successfully",
    });
  } catch (error) {
    console.error("Error completing provisioning:", error);
    return NextResponse.json(
      { error: "Failed to complete provisioning" },
      { status: 500 }
    );
  }
}
