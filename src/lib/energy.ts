/**
 * Filter energy-cost model.
 *
 * ECM (variable-speed) blowers ramp up to hold airflow constant as the
 * filter loads, so the extra electrical power is direct:
 *
 *   extraWatts = (ΔP − ΔP_baseline) × airflow / η
 *
 * PSC (fixed-speed) blowers do NOT ramp up — the blower actually draws a
 * little LESS as airflow drops. But the system pays anyway: less air across
 * the coil/heat-exchanger means less delivered heating/cooling per minute,
 * so the WHOLE system (compressor and all) runs longer to satisfy the
 * thermostat. We model that runtime stretch conservatively:
 *
 *   airflow loss   ≈ 0.2 %/Pa of ΔP rise      (typical PSC fan-curve slope)
 *   capacity loss  ≈ 0.5 × airflow loss       (sensible capacity ~ √airflow)
 *   system power   ≈ CFM/400 tons × ~1.1 kW/ton (compressor + fans estimate)
 *   extraWatts     = system power × capacity loss
 *
 * Why × capacity loss and not × the runtime stretch: we accrue against
 * OBSERVED runtime, which already includes the stretched minutes. Of each
 * observed hour, the wasted fraction is exactly the capacity loss
 * (stretch/(1+stretch) = capLoss), so charging capLoss per observed hour
 * is the exact bookkeeping, not an approximation.
 *
 * Both paths report honest, order-of-magnitude-right waste — the PSC figure
 * is an estimate of system-level energy, not a blower-plug measurement.
 *
 * Runtime detection is free: ΔP across the filter is ~0 when the blower is
 * off, so any reading above BLOWER_ON_MIN_PA counts as runtime.
 */

/** ΔP (Pa) above which we consider the blower to be running. */
export const BLOWER_ON_MIN_PA = 5;

/** Combined fan + motor + drive efficiency for a typical ECM blower. */
export const FAN_EFFICIENCY = 0.55;

/** PSC: fractional airflow lost per Pa of filter ΔP rise (fan-curve slope). */
export const PSC_AIRFLOW_LOSS_PER_PA = 0.002;

/** PSC: cap modeled airflow loss — beyond this the model is unreliable. */
export const PSC_MAX_AIRFLOW_LOSS = 0.4;

/** PSC: sensible capacity scales roughly with the square root of airflow. */
export const PSC_CAPACITY_EXPONENT = 0.5;

/** Whole-system electrical watts per rated ton (compressor + fans, typical). */
export const SYSTEM_WATTS_PER_TON = 1100;

/** Rule of thumb: rated airflow is ~400 CFM per ton of capacity. */
export const CFM_PER_TON = 400;

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

/** Extra system watts being wasted right now vs a clean filter. */
export function computeExtraWatts(
  deltaP: number,
  baselineDeltaP: number,
  airflowCfm: number,
  blowerType: string
): number {
  const extraPa = Math.max(0, deltaP - baselineDeltaP);
  if (extraPa === 0) return 0;

  if (blowerType === "ecm") {
    // Blower works harder to hold airflow — direct electrical cost
    return (extraPa * airflowCfm * CFM_TO_M3S) / FAN_EFFICIENCY;
  }

  // PSC: airflow drops → capacity drops → the whole system runs longer.
  // Accrued per OBSERVED (already-stretched) runtime hour, the wasted
  // fraction of each hour equals the capacity loss — see header comment.
  const airflowLoss = Math.min(
    PSC_MAX_AIRFLOW_LOSS,
    PSC_AIRFLOW_LOSS_PER_PA * extraPa
  );
  const capacityLoss = PSC_CAPACITY_EXPONENT * airflowLoss;
  const systemWatts = (airflowCfm / CFM_PER_TON) * SYSTEM_WATTS_PER_TON;
  return systemWatts * capacityLoss;
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
