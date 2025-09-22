import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import crypto from "crypto";

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
    const { deviceId, name, location } = body;

    if (!deviceId || !name) {
      return NextResponse.json(
        { error: "Device ID and name are required" },
        { status: 400 }
      );
    }

    // Check if device exists
    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    if (!existingDevice) {
      // Device not registered yet - register it first
      const apiToken = `sf_${crypto.randomBytes(32).toString('hex')}`;
      
      const newDevice = await db.device.create({
        data: {
          deviceId,
          userId: session.user.id,
          name,
          location,
          apiToken,
          type: "SmartFilter",
          firmware: "1.0.0",
          status: "active",
          lastSeen: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        device: {
          id: newDevice.id,
          deviceId: newDevice.deviceId,
          name: newDevice.name,
          location: newDevice.location,
          status: newDevice.status,
        },
        message: "Device linked successfully",
      });
    }

    // Check if device is already linked to another user
    if (existingDevice.userId && existingDevice.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Device is already linked to another account" },
        { status: 409 }
      );
    }

    // Update device with user information
    const updatedDevice = await db.device.update({
      where: { deviceId },
      data: {
        userId: session.user.id,
        name,
        location,
        status: "active",
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      device: {
        id: updatedDevice.id,
        deviceId: updatedDevice.deviceId,
        name: updatedDevice.name,
        location: updatedDevice.location,
        status: updatedDevice.status,
      },
      message: "Device linked successfully",
    });
  } catch (error) {
    console.error("Error linking device:", error);
    return NextResponse.json(
      { error: "Failed to link device" },
      { status: 500 }
    );
  }
}
