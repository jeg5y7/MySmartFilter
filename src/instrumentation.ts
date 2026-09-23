/**
 * Runs once per server boot (Next 15 instrumentation hook). Applies additive,
 * idempotent schema upgrades so new nullable columns exist BEFORE any Prisma
 * query selects them — closing the deploy-race that the "add columns in Neon
 * first" convention used to cover by hand. ADD COLUMN IF NOT EXISTS on a
 * nullable column is metadata-only in Postgres (instant, no table rewrite).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { db } = await import("~/server/db");
    // v1.11.0 firmware: per-reading pressure spread (turbulence/flow index)
    await db.$executeRawUnsafe(
      `ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "pressureStd" DOUBLE PRECISION`
    );
    // Baseline refinement marker (src/lib/baseline-refine.ts)
    await db.$executeRawUnsafe(
      `ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "baselineRefinedAt" TIMESTAMP(3)`
    );
    // Filter-as-flowmeter: airflow calibrations captured at each fresh-filter
    // install (see src/lib/filter-curves.ts)
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FlowCalibration" (
      "id" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "filterProductId" TEXT,
      "baselinePa" DOUBLE PRECISION NOT NULL,
      "q0Cfm" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FlowCalibration_pkey" PRIMARY KEY ("id")
    )`);
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "FlowCalibration_deviceId_createdAt_idx" ON "FlowCalibration"("deviceId", "createdAt")`
    );
    console.log("[instrumentation] schema upgrades ensured");

    // ── One-shot data repair (2026-09-23, remove after it has run) ─────────
    // A false "fresh filter detected" fired on the pilot device: the Sep 23
    // baseline refinement (106→119 Pa) moved the wet-coil sag band inside
    // the replacement detector's clean margin, so an afternoon sag reset the
    // baseline/install date/energy meter. The detector is fixed (dry-window
    // confirmation); this restores the device state: install date back to
    // the real Aug 22 swap, baseline recomputed as the dry-window median of
    // the first 48 h on that filter. Guarded so it only ever fires on the
    // bad state and is a no-op forever after.
    try {
      const repaired = await db.$executeRawUnsafe(`
        WITH bounds AS (
          SELECT TIMESTAMP '2026-08-22 17:00:00+00' AS installed,
                 TIMESTAMP '2026-08-24 17:00:00+00' AS wend
        ),
        r AS (
          SELECT s."timestamp", s.pressure,
                 LAG(s."timestamp") OVER w AS prev_ts,
                 LAG(s.pressure)    OVER w AS prev_p
          FROM "SensorReading" s, bounds b
          WHERE s."deviceId" = 'SF4453DF470968'
            AND s."sensorType" = 'pressure_differential'
            AND s."timestamp" BETWEEN b.installed AND b.wend
          WINDOW w AS (ORDER BY s."timestamp")
        ),
        marked AS (
          SELECT "timestamp", pressure,
                 CASE WHEN pressure >= 5 AND (prev_p IS NULL OR prev_p < 5 OR
                      EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) > 150)
                      THEN 1 ELSE 0 END AS run_start
          FROM r WHERE pressure >= 5
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
        ),
        med AS (
          SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY pressure) AS dry
          FROM runinfo
          WHERE EXTRACT(EPOCH FROM ("timestamp" - run_t0)) BETWEEN 120 AND 300
        )
        UPDATE "Device" d
        SET "baselineDeltaP" = med.dry,
            "filterInstalledAt" = (SELECT installed FROM bounds),
            "baselineRefinedAt" = NOW()
        FROM med
        WHERE d."deviceId" = 'SF4453DF470968'
          AND d."filterInstalledAt" >= TIMESTAMP '2026-09-22 00:00:00+00'
          AND med.dry IS NOT NULL
      `);
      if (repaired > 0) {
        console.log(
          "[instrumentation] pilot device filter state repaired (false replacement of 2026-09-23 undone)"
        );
      }
    } catch (err) {
      console.error("[instrumentation] pilot repair failed:", err);
    }
  } catch (err) {
    // Never block boot on this — the routes have their own fallbacks.
    console.error("[instrumentation] schema upgrade failed:", err);
  }
}
