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
  } catch (err) {
    // Never block boot on this — the routes have their own fallbacks.
    console.error("[instrumentation] schema upgrade failed:", err);
  }
}
