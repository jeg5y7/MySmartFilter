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
 * integrations. ECM systems: life = 1 − (accrued extra cost ÷ filter price).
 * PSC systems (no energy accrual): pressure vs threshold decides.
 */
export async function computeFilterHealth(
  device: Device,
  latestPressure: number | null
): Promise<FilterHealth> {
  const preference = device.userId
    ? await getEffectiveFilterPreference(device.userId, device.id)
    : null;
  const price = preference?.filterProduct.price ?? null;

  if (device.blowerType === "ecm" && price && price > 0) {
    const consumed = Math.min(1.5, device.extraEnergyCostCents / price);
    const lifePct = Math.max(0, Math.round((1 - consumed) * 100));
    const status: FilterStatus =
      consumed >= 1 ? "replace_now" : consumed >= 0.75 ? "replace_soon" : "ok";
    return { lifePct, status, filterPriceCents: price };
  }

  // PSC (or no price picked): threshold-based, coarser
  if (latestPressure !== null && device.baselineDeltaP !== null) {
    const span = device.pressureThreshold - device.baselineDeltaP;
    if (span > 0) {
      const consumed = Math.min(1.5, (latestPressure - device.baselineDeltaP) / span);
      const lifePct = Math.max(0, Math.round((1 - consumed) * 100));
      const status: FilterStatus =
        consumed >= 1 ? "replace_now" : consumed >= 0.75 ? "replace_soon" : "ok";
      return { lifePct, status, filterPriceCents: price };
    }
  }

  return {
    lifePct: null,
    status:
      latestPressure !== null && latestPressure >= device.pressureThreshold
        ? "replace_now"
        : "ok",
    filterPriceCents: price,
  };
}
