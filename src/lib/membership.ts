import { db } from "~/server/db";

/**
 * Filter AutoShip enrollment check — the tier gate.
 *
 * Working definition (see CLAUDE.md "Tiers"): the account has at least one
 * filter preference with auto-order enabled. The free tier keeps live data;
 * AutoShip includes the energy-savings calculation, historical trending, and
 * future diagnostics.
 */
export async function isAutoShipMember(userId: string): Promise<boolean> {
  const count = await db.userFilterPreference.count({
    where: { userId, autoOrderEnabled: true },
  });
  return count > 0;
}

/** Free tier can look back this far — "live" data. */
export const FREE_HISTORY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
