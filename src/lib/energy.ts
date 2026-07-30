/**
 * Filter energy-cost model.
 *
 * Physics: blower power ≈ (airflow × static pressure) / fan efficiency.
 * As a filter loads, ΔP across it rises. An ECM (variable-speed) blower ramps
 * up to hold airflow constant, so the extra electrical power is
 *
 *   extraWatts = (ΔP − ΔP_baseline) × airflow / η
 *
 * A PSC (fixed-speed) blower does NOT ramp up — airflow just drops, so a
 * clogged filter costs comfort and coil-freeze risk, not electricity. For PSC
 * systems we accrue no energy cost and rely on the pressure threshold alert.
 *
 * Runtime detection is free: ΔP across the filter is ~0 when the blower is
 * off, so any reading above BLOWER_ON_MIN_PA counts as runtime.
 */

/** ΔP (Pa) above which we consider the blower to be running. */
export const BLOWER_ON_MIN_PA = 5;

/** Combined fan + motor + drive efficiency for a typical ECM blower. */
export const FAN_EFFICIENCY = 0.55;

/** Cap integration steps so an offline gap can't accrue a huge block of cost. */
export const MAX_ACCRUAL_STEP_MS = 15 * 60 * 1000;

const CFM_TO_M3S = 0.000471947;

export interface EnergyDeviceState {
  blowerType: string; // "ecm" | "psc"
  airflowCfm: number;
  electricityRateCents: number; // ¢ per kWh
  baselineDeltaP: number | null;
  lastAccrualAt: Date | null;
}

export interface AccrualResult {
  runtimeHoursDelta: number;
  extraCostCentsDelta: number;
  /** Baseline to store if this reading established one (first blower-on reading). */
  newBaselineDeltaP: number | null;
}

/** Extra electrical watts drawn right now vs a clean filter (ECM only). */
export function computeExtraWatts(
  deltaP: number,
  baselineDeltaP: number,
  airflowCfm: number,
  blowerType: string
): number {
  if (blowerType !== "ecm") return 0;
  const extraPa = Math.max(0, deltaP - baselineDeltaP);
  return (extraPa * airflowCfm * CFM_TO_M3S) / FAN_EFFICIENCY;
}

/**
 * Integrate one sensor reading into runtime + extra-cost accumulators.
 * Call on every accepted reading; returns deltas to add to the device row.
 */
export function accrueReading(
  state: EnergyDeviceState,
  deltaP: number,
  now: Date
): AccrualResult {
  const blowerOn = deltaP >= BLOWER_ON_MIN_PA;

  // First blower-on reading after install/replacement establishes the baseline
  const newBaselineDeltaP =
    blowerOn && state.baselineDeltaP === null ? deltaP : null;

  if (!blowerOn || state.lastAccrualAt === null) {
    return { runtimeHoursDelta: 0, extraCostCentsDelta: 0, newBaselineDeltaP };
  }

  const stepMs = Math.min(
    Math.max(0, now.getTime() - state.lastAccrualAt.getTime()),
    MAX_ACCRUAL_STEP_MS
  );
  const stepHours = stepMs / 3_600_000;

  const baseline = state.baselineDeltaP ?? newBaselineDeltaP ?? deltaP;
  const extraWatts = computeExtraWatts(
    deltaP,
    baseline,
    state.airflowCfm,
    state.blowerType
  );
  const extraKwh = (extraWatts * stepHours) / 1000;
  const extraCostCentsDelta = extraKwh * state.electricityRateCents;

  return {
    runtimeHoursDelta: stepHours,
    extraCostCentsDelta,
    newBaselineDeltaP,
  };
}
