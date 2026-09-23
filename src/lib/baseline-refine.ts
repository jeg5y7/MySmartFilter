import { db } from "~/server/db";

/**
 * Baseline refinement.
 *
 * The provisional baseline is captured from the FIRST blower-on reading (or
 * the replacement-detection's confirming run) — samples that can sit on the
 * blower ramp and read ~10 Pa below the true dry plateau. Field case: the
 * pilot's Aug 2026 install stored ~106 Pa against a measured 118.5 Pa fresh
 * plateau, inflating the airflow-impact rise by ~12 Pa and mis-anchoring
 * the Q0 curve inversion and the alert ceiling.
 *
 * Once a fresh filter has 48 h of history, this replaces the provisional
 * value with the DRY-WINDOW median of that first 48 h (each run's minutes
 * 2–4 — same isolated-loading metric as the charts), then marks the device
 * refined so it never re-fires for that filter. Runs opportunistically from
 * ingestion (cheap: skipped instantly once refined) and re-records the
 * flow calibration against the corrected baseline.
 */

const REFINE_AFTER_MS = 48 * 3600 * 1000;
/** Don't churn the baseline (and alert ceiling) for sub-noise differences. */
const MIN_CORRECTION_PA = 2;

/** Per-instance debounce: one attempt per device per hour is plenty. */
const lastAttemptAt = new Map<string, number>();

interface MedianRow {
  dry: number | null;
}

export async function maybeRefineBaseline(device: {
  id: string;
  deviceId: string;
  userId: string | null;
  baselineDeltaP: number | null;
  baselineRefinedAt: Date | null;
  filterInstalledAt: Date | null;
}): Promise<void> {
  try {
    if (
      device.baselineDeltaP === null ||
      device.baselineRefinedAt !== null ||
      device.filterInstalledAt === null
    ) {
      return;
    }
    const installedMs = device.filterInstalledAt.getTime();
    if (Date.now() - installedMs < REFINE_AFTER_MS) return;

    const now = Date.now();
    const last = lastAttemptAt.get(device.deviceId) ?? 0;
    if (now - last < 3600 * 1000) return;
    lastAttemptAt.set(device.deviceId, now);

    const windowEnd = new Date(installedMs + REFINE_AFTER_MS);
    const rows = await db.$queryRaw<MedianRow[]>`
      WITH r AS (
        SELECT "timestamp", pressure,
               LAG("timestamp") OVER w AS prev_ts,
               LAG(pressure)    OVER w AS prev_p
        FROM "SensorReading"
        WHERE "deviceId" = ${device.deviceId}
          AND "sensorType" = 'pressure_differential'
          AND "timestamp" >= ${device.filterInstalledAt}
          AND "timestamp" <= ${windowEnd}
        WINDOW w AS (ORDER BY "timestamp")
      ),
      marked AS (
        SELECT "timestamp", pressure,
               CASE WHEN pressure >= 5 AND (
                      prev_p IS NULL OR prev_p < 5 OR
                      EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) > 150
                    ) THEN 1 ELSE 0 END AS run_start
        FROM r
        WHERE pressure >= 5
      ),
      runs AS (
        SELECT "timestamp", pressure,
               SUM(run_start) OVER (ORDER BY "timestamp") AS run_id
        FROM marked
      ),
      runinfo AS (
        SELECT "timestamp", pressure,
               MIN("timestamp") OVER (PARTITION BY run_id) AS run_t0
        FROM runs
      )
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY pressure) AS dry
      FROM runinfo
      WHERE EXTRACT(EPOCH FROM ("timestamp" - run_t0)) BETWEEN 120 AND 300
    `;
    const refined = rows[0]?.dry === null || rows[0]?.dry === undefined
      ? null
      : Number(rows[0].dry);
    if (refined === null || !isFinite(refined) || refined < 5) return;

    const delta = refined - device.baselineDeltaP;
    if (Math.abs(delta) < MIN_CORRECTION_PA) {
      // Provisional value was already good — just mark it settled.
      await db.device.update({
        where: { id: device.id },
        data: { baselineRefinedAt: new Date() },
      });
      return;
    }

    await db.device.update({
      where: { id: device.id },
      data: { baselineDeltaP: refined, baselineRefinedAt: new Date() },
    });
    console.log(
      `[baseline-refine] ${device.deviceId}: ${device.baselineDeltaP.toFixed(1)} → ${refined.toFixed(1)} Pa ` +
        `(dry-window median of first 48 h; correction ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} Pa)`
    );

    // Re-anchor the flow calibration against the corrected fresh point
    const { maybeRecordFlowCalibration } = await import("~/lib/filter-curves");
    void maybeRecordFlowCalibration(
      device.deviceId,
      device.id,
      device.userId,
      refined
    );
  } catch (err) {
    console.error(
      "[baseline-refine] skipped:",
      err instanceof Error ? err.message : err
    );
  }
}
