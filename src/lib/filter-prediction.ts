import { db } from "~/server/db";
import { alertCeilingPa } from "~/lib/filter-health";

/**
 * Filter life prediction — the dashboard chart.
 *
 * Fits a trend to the DAILY DRY-WINDOW pressure (each run's minutes 2–4,
 * before the cooling coil wets — the same isolated-loading metric as the
 * device charts, computed here in SQL with window functions) and projects
 * it forward to the device's alert ceiling (fresh baseline + allowed rise).
 * The intersection is the predicted replacement date.
 *
 * Honesty notes: the projection assumes recent usage patterns continue —
 * seasons change the loading rate, so the line re-fits every day. A filter
 * that isn't measurably loading yet gets history-only (no fabricated ETA).
 */

export interface DailyDryPoint {
  ts: number; // UTC day start
  pa: number;
}

export interface FilterPrediction {
  deviceId: string;
  deviceName: string | null;
  baseline: number;
  ceiling: number;
  currentPa: number;
  slopePaPerDay: number;
  history: DailyDryPoint[];
  /** Straight-line projection from today to the ceiling (empty if none). */
  projection: DailyDryPoint[];
  /** Days until the ceiling at the fitted rate; null when not projectable. */
  daysRemaining: number | null;
  predictedDate: Date | null;
}

interface DryRow {
  day: Date;
  dry: number | null;
}

/** Daily dry-window average since `since`, computed in SQL: run starts are
 *  off→on transitions or >150 s gaps; the dry window is 120–300 s into a
 *  run. (Rest-gating is omitted in SQL — the fitted slope is insensitive to
 *  the ~1 Pa wet-carryover offset since it affects days roughly equally.) */
async function dailyDrySeries(deviceId: string, since: Date): Promise<DailyDryPoint[]> {
  const rows = await db.$queryRaw<DryRow[]>`
    WITH r AS (
      SELECT "timestamp", pressure,
             LAG("timestamp") OVER w AS prev_ts,
             LAG(pressure)    OVER w AS prev_p
      FROM "SensorReading"
      WHERE "deviceId" = ${deviceId}
        AND "sensorType" = 'pressure_differential'
        AND "timestamp" >= ${since}
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
    SELECT date_trunc('day', "timestamp") AS day, AVG(pressure) AS dry
    FROM runinfo
    WHERE EXTRACT(EPOCH FROM ("timestamp" - run_t0)) BETWEEN 120 AND 300
    GROUP BY 1
    ORDER BY 1
  `;
  return rows
    .filter((r) => r.dry !== null)
    .map((r) => ({ ts: new Date(r.day).getTime(), pa: Number(r.dry) }));
}

/** Least-squares slope/intercept over (dayIndex, pa). */
function fitLine(points: DailyDryPoint[]): { slope: number; at: (ts: number) => number } {
  const t0 = points[0]!.ts;
  const xs = points.map((p) => (p.ts - t0) / 86400000);
  const ys = points.map((p) => p.pa);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, at: (ts: number) => intercept + slope * ((ts - t0) / 86400000) };
}

const MIN_DAYS_FOR_PROJECTION = 7;
const MAX_PROJECTION_DAYS = 400;

export async function computeFilterPrediction(device: {
  deviceId: string;
  name: string | null;
  baselineDeltaP: number | null;
  pressureThreshold: number;
  filterInstalledAt: Date | null;
}): Promise<FilterPrediction | null> {
  if (device.baselineDeltaP === null) return null;
  const since =
    device.filterInstalledAt ?? new Date(Date.now() - 90 * 86400000);
  let history: DailyDryPoint[];
  try {
    history = await dailyDrySeries(device.deviceId, since);
  } catch {
    return null;
  }
  if (history.length < 2) return null;

  const ceiling = alertCeilingPa(device);
  const fit = fitLine(history);
  const nowTs = history[history.length - 1]!.ts;
  const currentPa = fit.at(nowTs);

  let daysRemaining: number | null = null;
  let predictedDate: Date | null = null;
  const projection: DailyDryPoint[] = [];
  if (
    history.length >= MIN_DAYS_FOR_PROJECTION &&
    fit.slope > 0.01 &&
    currentPa < ceiling
  ) {
    const days = (ceiling - currentPa) / fit.slope;
    if (days <= MAX_PROJECTION_DAYS) {
      daysRemaining = Math.round(days);
      predictedDate = new Date(nowTs + days * 86400000);
      // Two points draw the straight projection; recharts fills the line.
      projection.push(
        { ts: nowTs, pa: currentPa },
        { ts: predictedDate.getTime(), pa: ceiling }
      );
    }
  }

  return {
    deviceId: device.deviceId,
    deviceName: device.name,
    baseline: device.baselineDeltaP,
    ceiling,
    currentPa,
    slopePaPerDay: fit.slope,
    history,
    projection,
    daysRemaining,
    predictedDate,
  };
}
