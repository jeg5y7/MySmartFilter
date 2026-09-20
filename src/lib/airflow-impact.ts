import {
  BLOWER_ON_MIN_PA,
  PSC_AIRFLOW_LOSS_PER_PA,
  PSC_MAX_AIRFLOW_LOSS,
} from "~/lib/energy";

/**
 * Airflow impact of filter loading — the headline metric on the device page.
 *
 * Pressure drop is what we MEASURE; reduced airflow is what the customer
 * FEELS (system runs longer, uses more energy). This module converts the
 * dry-window ΔP rise above the fresh-filter baseline into an estimated
 * airflow reduction using the SAME constants as the PSC energy model in
 * ~/lib/energy.ts (0.2 %/Pa fan-curve slope, capped) so the two never
 * disagree. When a FlowCalibration exists (manufacturer curve inverted at
 * install), the % also becomes real CFM.
 *
 * Blower-type currency: a PSC/fixed-speed fan actually loses airflow — show
 * the loss. A true variable-speed (ECM) fan defends its airflow and burns
 * extra watts instead — for those homes the honest headline is the extra
 * energy cost the device already accrues.
 */

/** Dry-window bounds within a run (same values as the chart aggregation). */
const DRY_START_S = 120;
const DRY_END_S = 300;
const RUN_GAP_S = 150;
const REST_MIN_S = 30 * 60;

export interface ReadingLike {
  pressure: number;
  timestamp: Date;
}

/**
 * Current dry-coil ΔP from recent readings (ascending order): median of
 * minutes-2–4 samples, preferring runs that started after ≥30 min of
 * confirmed rest. Falls back to ungated dry windows, then null.
 */
export function currentDryDeltaP(readings: ReadingLike[]): number | null {
  const rested: number[] = [];
  const any: number[] = [];
  let prev: ReadingLike | null = null;
  let runStartMs: number | null = null;
  let runIsRested = false;
  let offStartMs: number | null = null;

  for (const r of readings) {
    if (r.pressure >= BLOWER_ON_MIN_PA) {
      const prevOn = prev !== null && prev.pressure >= BLOWER_ON_MIN_PA;
      const gapSec = prev
        ? (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000
        : Infinity;
      if (!prevOn || gapSec > RUN_GAP_S) {
        runStartMs = r.timestamp.getTime();
        const offSec =
          offStartMs !== null ? (runStartMs - offStartMs) / 1000 : null;
        runIsRested = offSec !== null && offSec >= REST_MIN_S;
      }
      offStartMs = null;
      if (runStartMs !== null) {
        const sec = (r.timestamp.getTime() - runStartMs) / 1000;
        if (sec >= DRY_START_S && sec <= DRY_END_S) {
          any.push(r.pressure);
          if (runIsRested) rested.push(r.pressure);
        }
      }
    } else {
      if (offStartMs === null) offStartMs = r.timestamp.getTime();
      runStartMs = null;
    }
    prev = r;
  }

  const src = rested.length > 0 ? rested : any;
  if (src.length === 0) return null;
  const sorted = [...src].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
}

export type AirflowImpact =
  | {
      kind: "psc";
      /** 0–1 fraction of airflow lost to filter loading (estimated). */
      lossFraction: number;
      risePa: number;
      /** Real CFM lost — present only when a flow calibration exists. */
      cfmLost: number | null;
      q0Cfm: number | null;
    }
  | { kind: "ecm"; extraCostCents: number }
  | { kind: "pending"; reason: "no-baseline" | "no-recent-runs" };

export function computeAirflowImpact(
  device: {
    blowerType: string;
    baselineDeltaP: number | null;
    extraEnergyCostCents: number;
  },
  recentReadings: ReadingLike[],
  q0Cfm: number | null
): AirflowImpact {
  if (device.blowerType === "ecm") {
    return { kind: "ecm", extraCostCents: device.extraEnergyCostCents };
  }
  if (device.baselineDeltaP === null) {
    return { kind: "pending", reason: "no-baseline" };
  }
  const dryNow = currentDryDeltaP(recentReadings);
  if (dryNow === null) {
    return { kind: "pending", reason: "no-recent-runs" };
  }
  const risePa = Math.max(0, dryNow - device.baselineDeltaP);
  const lossFraction = Math.min(
    PSC_MAX_AIRFLOW_LOSS,
    PSC_AIRFLOW_LOSS_PER_PA * risePa
  );
  return {
    kind: "psc",
    lossFraction,
    risePa,
    cfmLost: q0Cfm !== null ? Math.round(q0Cfm * lossFraction) : null,
    q0Cfm,
  };
}
