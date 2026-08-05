import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import { dispatchWebhook } from "~/lib/webhooks";
import { accrueReading, type EnergyDeviceState } from "~/lib/energy";
import { maybeTriggerEnergyAlert } from "~/lib/filter-alerts";
import { rateLimit, tooManyRequests } from "~/lib/rate-limit";
import { resend, EMAIL_FROM } from "~/lib/resend";
import { computeFilterHealth } from "~/lib/filter-health";

/**
 * POST /api/sensor/batch — battery-firmware ingest.
 *
 * The monitor samples locally with WiFi off and uploads a batch per connect.
 * Each reading carries `ageSeconds` (how long ago it was taken); the server
 * reconstructs absolute timestamps so devices don't need a synced clock.
 */
const BatchSchema = z.object({
  readings: z
    .array(
      z.object({
        pressure: z.number(),
        temperature: z.number(),
        ageSeconds: z.number().min(0).max(24 * 3600),
        humidity: z.number().optional(),
        co2: z.number().optional(),
        voc: z.number().optional(),
      })
    )
    .min(1)
    .max(240),
  batteryPct: z.number().min(0).max(100).optional(),
  reportingIntervalMin: z.number().int().min(1).max(120).optional(),
});

const LOW_BATTERY_PCT = 20;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const apiToken = authHeader.substring(7);

    // Hourly cadence + exception pushes: 30 connects/hour is generous headroom
    const rl = rateLimit(`sensor-batch:${apiToken}`, 30, 60 * 60 * 1000);
    if (!rl.ok) return tooManyRequests(rl);

    const device = await db.device.findUnique({ where: { apiToken } });
    if (!device) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }
    if (!device.userId) {
      return NextResponse.json(
        { error: "Device not linked to a user account" },
        { status: 403 }
      );
    }

    const parsed = BatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data format", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const { readings, batteryPct, reportingIntervalMin } = parsed.data;

    const now = new Date();
    // Oldest first (largest age first) so accrual integrates forward in time
    const ordered = [...readings].sort((a, b) => b.ageSeconds - a.ageSeconds);
    const stamped = ordered.map((r) => ({
      ...r,
      timestamp: new Date(now.getTime() - r.ageSeconds * 1000),
    }));

    // Fold the energy accrual across the batch, threading state forward
    const state: EnergyDeviceState = {
      blowerType: device.blowerType,
      airflowCfm: device.airflowCfm,
      electricityRateCents: device.electricityRateCents,
      baselineDeltaP: device.baselineDeltaP,
      lastAccrualAt: device.lastAccrualAt,
    };
    let runtimeDelta = 0;
    let costDelta = 0;
    let newBaseline: number | null = null;
    let baselineAt: Date | null = null;

    for (const r of stamped) {
      const acc = accrueReading(state, r.pressure, r.timestamp);
      runtimeDelta += acc.runtimeHoursDelta;
      costDelta += acc.extraCostCentsDelta;
      if (acc.newBaselineDeltaP !== null && state.baselineDeltaP === null) {
        newBaseline = acc.newBaselineDeltaP;
        baselineAt = r.timestamp;
        state.baselineDeltaP = acc.newBaselineDeltaP;
      }
      state.lastAccrualAt = r.timestamp;
    }

    await db.sensorReading.createMany({
      data: stamped.map((r) => ({
        pressure: r.pressure,
        temperature: r.temperature,
        timestamp: r.timestamp,
        deviceId: device.deviceId,
        userId: device.userId!,
        sensorType: "pressure_differential",
        ...(r.humidity !== undefined && { humidity: r.humidity }),
        ...(r.co2 !== undefined && { co2: r.co2 }),
        ...(r.voc !== undefined && { voc: r.voc }),
      })),
    });

    const previousBattery = device.batteryPct;
    const updatedDevice = await db.device.update({
      where: { id: device.id },
      data: {
        lastSeen: now,
        status: "active",
        lastAccrualAt: state.lastAccrualAt,
        runtimeHours: { increment: runtimeDelta },
        extraEnergyCostCents: { increment: costDelta },
        ...(newBaseline !== null && {
          baselineDeltaP: newBaseline,
          filterInstalledAt: device.filterInstalledAt ?? baselineAt,
        }),
        ...(batteryPct !== undefined && { batteryPct }),
        ...(reportingIntervalMin !== undefined && { reportingIntervalMin }),
      },
    });

    const newest = stamped[stamped.length - 1]!;

    // Threshold webhook on the newest reading (alert dedupe lives downstream)
    if (newest.pressure >= device.pressureThreshold) {
      void dispatchWebhook(device.userId, "reading.threshold", {
        deviceId: device.deviceId,
        deviceName: device.name ?? device.deviceId,
        pressure: newest.pressure,
        temperature: newest.temperature,
        threshold: device.pressureThreshold,
        timestamp: newest.timestamp,
      });
    }

    // Energy-cost alert check (deduped internally)
    try {
      await maybeTriggerEnergyAlert(updatedDevice, newest.pressure);
    } catch (err) {
      console.error("[sensor/batch] energy alert check failed:", err);
    }

    // Low-battery email on downward crossing of the threshold
    if (
      batteryPct !== undefined &&
      batteryPct <= LOW_BATTERY_PCT &&
      (previousBattery === null || previousBattery > LOW_BATTERY_PCT)
    ) {
      void sendLowBatteryEmail(device.userId, device.name ?? device.deviceId, batteryPct);
    }

    // Tell the device its filter status so the button-press LED can show it
    const health = await computeFilterHealth(updatedDevice, newest.pressure);

    return NextResponse.json({
      success: true,
      stored: stamped.length,
      runtimeHoursAdded: Number(runtimeDelta.toFixed(4)),
      filterStatus: health.status,
    });
  } catch (error) {
    console.error("Error in batch ingest:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function sendLowBatteryEmail(userId: string, deviceName: string, pct: number) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return;
    await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `🔋 Battery low on ${deviceName} — ${Math.round(pct)}%`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">🔋 Time for fresh batteries</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        The batteries in <strong style="color:#e2e8f0;">${deviceName}</strong> are at
        <strong style="color:#fbbf24;">${Math.round(pct)}%</strong>. Swap in 3 fresh AA
        batteries in the next couple of weeks to keep monitoring uninterrupted — the
        battery door is on the back, no tools needed.
      </p>
      <p style="color:#64748b;font-size:13px;margin-bottom:0;">
        Your settings and WiFi connection are kept during battery changes.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Low battery email failed:", err);
  }
}
