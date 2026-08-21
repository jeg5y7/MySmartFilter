import type { Device } from "@prisma/client";
import { db } from "~/server/db";
import { resend, EMAIL_FROM, escapeHtml } from "~/lib/resend";
import { BLOWER_ON_MIN_PA } from "~/lib/energy";

/**
 * Automatic new-filter detection.
 *
 * A fresh filter announces itself two ways: blower-on ΔP falls sharply from
 * the loaded level back to the clean baseline and stays there (path A), or —
 * when the monitor was installed on an already-dirty filter — ΔP settles into
 * a stable plateau well BELOW the stored baseline (path B). Either way we
 * re-baseline and reset the cost accumulators without the customer touching
 * anything — the monitor simply notices.
 *
 * Guards against false positives:
 *  - the filter must actually have been loaded (meaningful rise or accrued
 *    cost) — otherwise normal noise near a fresh baseline would retrigger
 *  - the drop must hold for N consecutive blower-on readings (a door left
 *    open or a blower ramp can produce one low reading, not three)
 *  - readings must be at/below baseline + a small margin — a partial drop
 *    (e.g. filter reseated) doesn't count
 */

/** Blower-on readings in a row that must sit at clean level. */
const CONSEC_CLEAN_READINGS = 3;

/** "Clean" means within this margin above the old baseline (Pa). */
const CLEAN_MARGIN_PA = 4;

/** The filter counts as "loaded" if recent ΔP exceeded baseline by this. */
const LOADED_RISE_PA = 15;

/** ...or if this much cost had accrued (¢). */
const LOADED_COST_CENTS = 10;

/**
 * Downward path: the stored baseline was captured on an already-dirty
 * filter (a monitor installed mid-filter-life), so a fresh filter plateaus
 * BELOW it and the return-to-baseline path above can never fire. A
 * sustained, STABLE plateau this far under baseline is a new filter — ΔP
 * across a filter only moves durably downward when the filter is replaced.
 */
const DROP_MARGIN_PA = 8;

/** Consecutive blower-on readings that must hold the lower plateau. */
const DROP_CONSEC_READINGS = 5;

/** Max spread (Pa) within those readings — a blower ramp-up passes through
 *  low values but rises fast, so it fails this stability check. */
const DROP_STABILITY_PA = 6;

/**
 * Call after storing a blower-on pressure reading. Returns true if a
 * replacement was detected and the device was reset.
 */
export async function maybeDetectFilterReplacement(
  device: Device,
  currentPressure: number
): Promise<boolean> {
  const baseline = device.baselineDeltaP;
  if (baseline === null) return false;
  if (currentPressure < BLOWER_ON_MIN_PA) return false; // blower off — no signal
  if (currentPressure > baseline + CLEAN_MARGIN_PA) return false; // not clean-level

  // Recent blower-on history: the newest few must all be clean-level, and
  // before them the filter must have actually been loaded.
  const recent = await db.sensorReading.findMany({
    where: {
      deviceId: device.deviceId,
      sensorType: "pressure_differential",
      pressure: { gte: BLOWER_ON_MIN_PA },
    },
    orderBy: { timestamp: "desc" },
    take: 20,
    select: { pressure: true },
  });

  // ── Path A: loaded filter dropped back to the clean baseline ─────────────
  const cleanRun = recent.slice(0, CONSEC_CLEAN_READINGS);
  let detected = false;
  let newBaselineRun: number[] = [];
  let pathLabel = "";

  if (
    cleanRun.length === CONSEC_CLEAN_READINGS &&
    cleanRun.every((r) => r.pressure <= baseline + CLEAN_MARGIN_PA)
  ) {
    const priorPeak = Math.max(
      0,
      ...recent.slice(CONSEC_CLEAN_READINGS).map((r) => r.pressure)
    );
    const wasLoaded =
      priorPeak - baseline >= LOADED_RISE_PA ||
      device.extraEnergyCostCents >= LOADED_COST_CENTS;
    if (wasLoaded) {
      detected = true;
      newBaselineRun = cleanRun.map((r) => r.pressure);
      pathLabel = `return-to-baseline (peak ${priorPeak.toFixed(1)})`;
    }
  }

  // ── Path B: stable plateau well BELOW baseline (baseline was captured on
  //    an already-dirty filter; the fresh one reads lower) ──────────────────
  if (!detected) {
    const dropRun = recent.slice(0, DROP_CONSEC_READINGS);
    if (
      dropRun.length === DROP_CONSEC_READINGS &&
      dropRun.every((r) => r.pressure <= baseline - DROP_MARGIN_PA)
    ) {
      const values = dropRun.map((r) => r.pressure);
      const spread = Math.max(...values) - Math.min(...values);
      if (spread <= DROP_STABILITY_PA) {
        detected = true;
        newBaselineRun = values;
        pathLabel = `sustained-drop (spread ${spread.toFixed(1)})`;
      }
    }
  }

  if (!detected) return false;

  // New filter confirmed. Set the baseline straight from the observed clean
  // plateau (median of the confirming run) rather than recapturing from the
  // next reading — the next reading might land mid blower-ramp and skew low.
  const sortedRun = [...newBaselineRun].sort((a, b) => a - b);
  const newBaseline = sortedRun[Math.floor(sortedRun.length / 2)]!;

  const now = new Date();
  await db.$transaction([
    db.device.update({
      where: { id: device.id },
      data: {
        baselineDeltaP: newBaseline,
        filterInstalledAt: now,
        runtimeHours: 0,
        extraEnergyCostCents: 0,
        lastAccrualAt: null,
      },
    }),
    db.filterAlert.updateMany({
      where: { deviceId: device.id, status: { in: ["pending", "notified"] } },
      data: { status: "dismissed", resolvedAt: now },
    }),
  ]);

  console.log(
    `[filter-replacement] auto-detected on ${device.deviceId} via ${pathLabel}: ` +
      `ΔP ${currentPressure.toFixed(1)} Pa vs baseline ${baseline.toFixed(1)} Pa → new baseline ${newBaseline.toFixed(1)} Pa`
  );

  if (device.userId) {
    void sendReplacementDetectedEmail(device.userId, escapeHtml(device.name ?? device.deviceId));
  }
  return true;
}

async function sendReplacementDetectedEmail(userId: string, deviceName: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return;
    await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `✨ New filter detected on ${deviceName}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">✨ Fresh filter detected</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        <strong style="color:#e2e8f0;">${deviceName}</strong> noticed the pressure
        drop of a brand-new filter, so we've reset its tracking automatically —
        the savings meter starts fresh from today. Nothing for you to do.
      </p>
      <p style="color:#64748b;font-size:13px;margin-bottom:0;">
        Didn't change your filter? A big airflow change (like a duct repair)
        can look similar — check the dashboard if this seems off.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Replacement-detected email failed:", err);
  }
}
