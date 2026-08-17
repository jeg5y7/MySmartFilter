import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import { dispatchWebhook } from "~/lib/webhooks";
import { accrueReading } from "~/lib/energy";
import { maybeTriggerEnergyAlert } from "~/lib/filter-alerts";
import { maybeDetectFilterReplacement } from "~/lib/filter-replacement";
import { computeFilterHealth, alertCeilingPa } from "~/lib/filter-health";
import { rateLimit, tooManyRequests } from "~/lib/rate-limit";

// Schema for validating ESP32 sensor data
const SensorDataSchema = z.object({
  pressure: z.number(),
  temperature: z.number(),
  deviceId: z.string().optional(), // Optional, will be inferred from token
  // Multi-sensor support (all optional, backward-compatible)
  sensorType: z.string().optional().default("pressure_differential"),
  humidity: z.number().optional(),
  co2: z.number().optional(),
  voc: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get API token from Authorization header (never log tokens)
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.substring(7);

    // A healthy device posts every ~30s; 120/5min leaves generous headroom
    const rl = rateLimit(`sensor:${apiToken}`, 120, 5 * 60 * 1000);
    if (!rl.ok) return tooManyRequests(rl);

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

    const { pressure, temperature, sensorType, humidity, co2, voc } = result.data;

    const now = new Date();

    // Energy model: only pressure-differential readings drive the accumulators
    const isPressureReading =
      (sensorType ?? "pressure_differential") === "pressure_differential";
    const accrual = isPressureReading
      ? accrueReading(device, pressure, now)
      : { runtimeHoursDelta: 0, extraCostCentsDelta: 0, newBaselineDeltaP: null };

    // Update device last seen time + energy accumulators
    const updatedDevice = await db.device.update({
      where: { id: device.id },
      data: {
        lastSeen: now,
        status: "active",
        ...(isPressureReading && {
          lastAccrualAt: now,
          runtimeHours: { increment: accrual.runtimeHoursDelta },
          extraEnergyCostCents: { increment: accrual.extraCostCentsDelta },
          ...(accrual.newBaselineDeltaP !== null && {
            baselineDeltaP: accrual.newBaselineDeltaP,
            filterInstalledAt: device.filterInstalledAt ?? now,
          }),
        }),
      },
    });

    // Create the sensor reading in the database
    const sensorReading = await db.sensorReading.create({
      data: {
        pressure,
        temperature,
        deviceId: device.deviceId,
        userId: device.userId,
        sensorType: sensorType ?? "pressure_differential",
        ...(humidity !== undefined && { humidity }),
        ...(co2 !== undefined && { co2 }),
        ...(voc !== undefined && { voc }),
      },
    });

    // Fire webhook for reading.threshold if pressure exceeds the alert
    // ceiling (fresh-filter baseline + allowed rise)
    if (pressure >= alertCeilingPa(updatedDevice) && device.userId) {
      void dispatchWebhook(device.userId, "reading.threshold", {
        deviceId: device.deviceId,
        deviceName: device.name ?? device.deviceId,
        pressure,
        temperature,
        threshold: alertCeilingPa(updatedDevice),
        readingId: sensorReading.id,
        timestamp: sensorReading.timestamp,
      });
    }

    // Energy-cost trigger: alert + (optional) auto-order once the extra
    // electricity spent exceeds the price of the preferred replacement filter
    if (isPressureReading) {
      try {
        await maybeTriggerEnergyAlert(updatedDevice, pressure);
      } catch (err) {
        console.error("[sensor] energy alert check failed:", err);
      }
      // A sharp sustained drop back to clean-baseline ΔP means a new filter
      // was installed — reset tracking automatically, no button needed
      try {
        await maybeDetectFilterReplacement(updatedDevice, pressure);
      } catch (err) {
        console.error("[sensor] replacement detection failed:", err);
      }
    }

    // Tell the device its filter verdict so the glow light can show it
    let filterStatus: string | null = null;
    try {
      const health = await computeFilterHealth(updatedDevice, pressure);
      filterStatus = health.status;
    } catch (err) {
      console.error("[sensor] filter health compute failed:", err);
    }

    return NextResponse.json({
      success: true,
      filterStatus,
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
