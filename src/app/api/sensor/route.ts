import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";

// Schema for validating ESP32 sensor data
const SensorDataSchema = z.object({
  pressure: z.number(),
  temperature: z.number(),
  deviceId: z.string(),
  userId: z.string(), // For now, ESP32 will need to include user ID
  apiKey: z.string().optional(), // Optional API key for security
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the incoming data
    const result = SensorDataSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data format", details: result.error.format() },
        { status: 400 }
      );
    }

    const { pressure, temperature, deviceId, userId } = result.data;

    // TODO: Add API key validation here if needed
    // if (apiKey !== process.env.ESP32_API_KEY) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Create the sensor reading in the database
    const sensorReading = await db.sensorReading.create({
      data: {
        pressure,
        temperature,
        deviceId,
        userId,
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
