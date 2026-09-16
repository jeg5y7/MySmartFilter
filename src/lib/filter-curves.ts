import type { FilterProduct } from "@prisma/client";
import { db } from "~/server/db";

/**
 * Filter-as-flowmeter.
 *
 * Because AutoShip means WE ship the filter, we know the exact model in the
 * duct — and a fresh filter with a known manufacturer flow-vs-ΔP curve IS a
 * calibrated flow meter. At each fresh-filter install (auto-detected or the
 * "I just replaced this filter" button) we invert the curve at the observed
 * clean baseline to get the system's operating airflow Q0 (CFM) and store a
 * FlowCalibration row. Trended across filter changes, declining Q0 exposes
 * coil fouling / duct problems independent of the filter.
 *
 * CURVES ARE REAL DATASHEET NUMBERS ONLY — never estimates. An empty or
 * missing curve simply skips calibration (no row is written); nothing is
 * shown in the UI until a genuine curve exists for the installed product.
 * Points are (cfm, pa) from the manufacturer's fresh-filter rating table,
 * ascending by cfm; 2+ points required. The founder supplies these from the
 * spec sheets of the filters we stock.
 */

/** Registry keyed by normalized `${size}|merv${merv}` (lowercase, no spaces). */
const CURVES: Record<string, { cfm: number; pa: number }[]> = {
  // e.g. "20x25x1|merv11": [
  //   { cfm: 492, pa: 22.4 },
  //   { cfm: 984, pa: 62.3 },
  //   { cfm: 1389, pa: 112.1 },
  // ],
};

export function curveKeyFor(product: Pick<FilterProduct, "size" | "merv">): string {
  const size = (product.size ?? "").toLowerCase().replace(/\s+/g, "");
  return `${size}|merv${product.merv ?? "?"}`;
}

/**
 * Invert the curve: observed fresh-filter ΔP → airflow (CFM).
 * ΔP across pleated media grows ~quadratically with flow, so between curve
 * points we interpolate in (Q², ΔP) space and extrapolate a short way past
 * the last point on the same fitted parabola. Returns null when no genuine
 * curve exists or the reading is far outside the curve's span.
 */
export function airflowFromCurve(
  product: Pick<FilterProduct, "size" | "merv">,
  baselinePa: number
): number | null {
  const curve = CURVES[curveKeyFor(product)];
  if (!curve || curve.length < 2 || baselinePa <= 0) return null;

  const pts = [...curve].sort((a, b) => a.cfm - b.cfm);
  // Fit ΔP = k·Q² through each adjacent pair; find the segment containing
  // baselinePa (curves are monotonic in ΔP for monotonic Q).
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const lo = Math.min(a.pa, b.pa);
    const hi = Math.max(a.pa, b.pa);
    const inSegment = baselinePa >= lo && baselinePa <= hi;
    const extrapolatingHigh =
      i === pts.length - 2 && baselinePa > hi && baselinePa <= hi * 1.5;
    const extrapolatingLow = i === 0 && baselinePa < lo && baselinePa >= lo * 0.5;
    if (!inSegment && !extrapolatingHigh && !extrapolatingLow) continue;
    // Linear interpolation in (Q², ΔP): Q² = qa² + (Δp−pa)·(qb²−qa²)/(pb−pa)
    const qa2 = a.cfm * a.cfm;
    const qb2 = b.cfm * b.cfm;
    if (b.pa === a.pa) return null;
    const q2 = qa2 + ((baselinePa - a.pa) * (qb2 - qa2)) / (b.pa - a.pa);
    if (q2 <= 0) return null;
    return Math.round(Math.sqrt(q2));
  }
  return null;
}

/**
 * Record an airflow calibration for a fresh-filter event. Fire-and-forget:
 * any failure (no preference, no curve, table missing) just skips.
 */
export async function maybeRecordFlowCalibration(
  deviceId: string,
  devicePk: string,
  userId: string | null,
  baselinePa: number
): Promise<void> {
  try {
    if (!userId) return;
    const { getEffectiveFilterPreference } = await import("~/lib/filter-preference");
    const preference = await getEffectiveFilterPreference(userId, devicePk);
    if (!preference) return;
    const q0 = airflowFromCurve(preference.filterProduct, baselinePa);
    if (q0 === null) return;
    await db.flowCalibration.create({
      data: {
        deviceId,
        filterProductId: preference.filterProduct.id,
        baselinePa,
        q0Cfm: q0,
      },
    });
    console.log(
      `[flow-cal] ${deviceId}: fresh ${preference.filterProduct.size} MERV${preference.filterProduct.merv} at ${baselinePa.toFixed(1)} Pa → ~${q0} CFM`
    );
  } catch (err) {
    console.error("[flow-cal] skipped:", err instanceof Error ? err.message : err);
  }
}
