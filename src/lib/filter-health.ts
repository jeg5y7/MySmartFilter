import type { Device } from "@prisma/client";
import { getEffectiveFilterPreference } from "~/lib/filter-preference";

export type FilterStatus = "ok" | "replace_soon" | "replace_now";

export interface FilterHealth {
  /** 100 = fresh filter, 0 = replacement fully justified. Null when uncomputable. */
  lifePct: number | null;
  status: FilterStatus;
  filterPriceCents: number | null;
}

/**
 * The pressure ceiling is BASELINE-RELATIVE: pressureThreshold is the allowed
 * RISE above the fresh-filter baseline, not an absolute reading. Real installs
 * taught us why — the first pilot unit's fresh-filter plateau (~120 Pa) sat
 * far above the old absolute default (50 Pa), which silently disabled the
 * pressure signal (negative span). Absolute plateaus vary wildly per home;
 * the rise above each home's own baseline is comparable everywhere.
 */
export function alertCeilingPa(device: {
  baselineDeltaP: number | null;
  pressureThreshold: number;
}): number {
  return (device.baselineDeltaP ?? 0) + device.pressureThreshold;
}

/**
 * Shared filter-health summary used by the public API and smart-home
 * integrations. Both blower types accrue wasted-energy cost (ECM as direct
 * blower watts, PSC as the system-runtime penalty), so when a filter price
 * is on file: life = 1 − (accrued extra cost ÷ filter price). The pressure
 * ceiling acts as a parallel signal — whichever signal is worse wins.
 */
export async function computeFilterHealth(
  device: Device,
  latestPressure: number | null
): Promise<FilterHealth> {
  const preference = device.userId
    ? await getEffectiveFilterPreference(device.userId, device.id)
    : null;
  const price = preference?.filterProduct.price ?? null;

  const consumedSignals: number[] = [];
  if (price && price > 0) {
    consumedSignals.push(Math.min(1.5, device.extraEnergyCostCents / price));
  }
  if (
    latestPressure !== null &&
    device.baselineDeltaP !== null &&
    device.pressureThreshold > 0
  ) {
    const rise = Math.max(0, latestPressure - device.baselineDeltaP);
    consumedSignals.push(Math.min(1.5, rise / device.pressureThreshold));
  }

  if (consumedSignals.length > 0) {
    const consumed = Math.max(...consumedSignals);
    const lifePct = Math.max(0, Math.round((1 - consumed) * 100));
    const status: FilterStatus =
      consumed >= 1 ? "replace_now" : consumed >= 0.75 ? "replace_soon" : "ok";
    return { lifePct, status, filterPriceCents: price };
  }

  // No price and no baseline yet: compare against the ceiling (baseline
  // still null here, so this is effectively the raw rise allowance)
  return {
    lifePct: null,
    status:
      latestPressure !== null && latestPressure >= alertCeilingPa(device)
        ? "replace_now"
        : "ok",
    filterPriceCents: price,
  };
}
