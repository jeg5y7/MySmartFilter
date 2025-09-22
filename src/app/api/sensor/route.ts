import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";

// Schema for validating ESP32 sensor data
const SensorDataSchema = z.object({
  pressure: z.number(),
  temperature: z.number(),
  deviceId: z.string().optional(), // Optional, will be inferred from token
});

export async function POST(request: NextRequest) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get("authorization");
    console.log("[SENSOR API] Authorization header:", authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[SENSOR API] Missing or invalid auth header");
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.substring(7);
    console.log("[SENSOR API] Extracted token:", apiToken.substring(0, 20) + "...");

    // Find device by API token
    const device = await db.device.findUnique({
      where: { apiToken },
    });

    console.log("[SENSOR API] Device lookup result:", device ? `Found device ${device.deviceId}` : "No device found");

    if (!device) {
      console.log("[SENSOR API] Token not found in database");
      return NextResponse.json(
        { error: "Invalid API token" },
        { status: 401 }
      );
    }

    // Check if device is linked to a user
    if (!device.userId) {
      return NextResponse.json(
        { error: "Device not linked to a user account" },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    
    // Validate the incoming data
    const result = SensorDataSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data format", details: result.error.format() },
        { status: 400 }
      );
    }

    const { pressure, temperature } = result.data;

    // Update device last seen time
    await db.device.update({
      where: { id: device.id },
      data: {
        lastSeen: new Date(),
        status: "active",
      },
    });

    // Create the sensor reading in the database
    const sensorReading = await db.sensorReading.create({
      data: {
        pressure,
        temperature,
        deviceId: device.deviceId, // Use deviceId from authenticated device
        userId: device.userId, // Use userId from authenticated device
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: sensorReading.id,
        timestamp: sensorReading.timestamp,
      },
    });

  } catch (error) {
    console.error("Error saving sensor data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve recent sensor data (for testing)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const deviceId = searchParams.get("deviceId");
    const limit = parseInt(searchParams.get("limit") ?? "10");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const readings = await db.sensorReading.findMany({
      where: {
        userId,
        ...(deviceId && { deviceId }),
      },
      orderBy: { timestamp: "desc" },
      take: Math.min(limit, 100), // Limit to max 100 records
    });

    return NextResponse.json({
      success: true,
      data: readings,
      count: readings.length,
    });

  } catch (error) {
    console.error("Error fetching sensor data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
