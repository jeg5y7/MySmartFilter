import { NextResponse } from "next/server";
import { db } from "~/server/db";
import crypto from "crypto";

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

/**
 * ESP32 self-registration.
 *
 * The device generates a random `deviceSecret` on first boot, stores it in
 * NVS, and sends it with every register call. The API token is only returned
 * when the presented secret matches the one on file, so knowing a deviceId
 * (e.g. from a QR label) is not enough to steal the token.
 *
 * Devices registered before secrets existed have no hash on file; the first
 * caller that presents a secret claims them (ratchet upgrade).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceId?: string;
      deviceSecret?: string;
      type?: string;
      firmware?: string;
    };
    const { deviceId, deviceSecret, type, firmware } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    if (existingDevice) {
      if (existingDevice.deviceSecretHash) {
        // Secret on file — require a match to return the token
        if (!deviceSecret || sha256(deviceSecret) !== existingDevice.deviceSecretHash) {
          return NextResponse.json(
            { error: "Device already registered" },
            { status: 403 }
          );
        }
      } else if (deviceSecret) {
        // Legacy device without a secret — first presenter claims it
        await db.device.update({
          where: { deviceId },
          data: { deviceSecretHash: sha256(deviceSecret) },
        });
      }

      return NextResponse.json({
        success: true,
        token: existingDevice.apiToken,
        message: "Device already registered",
      });
    }

    // Generate API token for device
    const apiToken = `sf_${crypto.randomBytes(32).toString("hex")}`;

    // Register new device (without userId - will be linked later)
    const newDevice = await db.device.create({
      data: {
        deviceId,
        apiToken,
        deviceSecretHash: deviceSecret ? sha256(deviceSecret) : null,
        type: type ?? "SmartFilter",
        firmware: firmware ?? "1.0.0",
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
