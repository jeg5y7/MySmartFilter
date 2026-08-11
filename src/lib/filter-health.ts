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
 * Shared filter-health summary used by the public API and smart-home
 * integrations. Both blower types accrue wasted-energy cost (ECM as direct
 * blower watts, PSC as the system-runtime penalty), so when a filter price
 * is on file: life = 1 − (accrued extra cost ÷ filter price). The pressure
 * threshold acts as a parallel ceiling — whichever signal is worse wins.
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
  if (latestPressure !== null && device.baselineDeltaP !== null) {
    const span = device.pressureThreshold - device.baselineDeltaP;
    if (span > 0) {
      consumedSignals.push(
        Math.min(1.5, (latestPressure - device.baselineDeltaP) / span)
      );
    }
  }

  if (consumedSignals.length > 0) {
    const consumed = Math.max(...consumedSignals);
    const lifePct = Math.max(0, Math.round((1 - consumed) * 100));
    const status: FilterStatus =
      consumed >= 1 ? "replace_now" : consumed >= 0.75 ? "replace_soon" : "ok";
    return { lifePct, status, filterPriceCents: price };
  }

  // No price and no baseline yet: raw threshold check is all we have
  return {
    lifePct: null,
    status:
      latestPressure !== null && latestPressure >= device.pressureThreshold
        ? "replace_now"
        : "ok",
    filterPriceCents: price,
  };
}
