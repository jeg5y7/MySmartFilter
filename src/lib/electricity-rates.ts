/**
 * Average residential electricity rates by state, ¢/kWh.
 * Source: EIA state residential averages (approximate, updated manually).
 * Used only as a smarter default / suggestion — the customer's utility-bill
 * number always wins.
 */
export const STATE_AVG_RATE_CENTS: Record<string, number> = {
  AL: 15, AK: 25, AZ: 15, AR: 12, CA: 30, CO: 14, CT: 27, DE: 16, DC: 18,
  FL: 15, GA: 14, HI: 41, ID: 11, IL: 16, IN: 15, IA: 13, KS: 14, KY: 13,
  LA: 12, ME: 23, MD: 17, MA: 29, MI: 19, MN: 15, MS: 13, MO: 12, MT: 12,
  NE: 12, NV: 15, NH: 25, NJ: 18, NM: 14, NY: 23, NC: 13, ND: 11, OH: 15,
  OK: 12, OR: 14, PA: 18, RI: 27, SC: 14, SD: 12, TN: 13, TX: 15, UT: 11,
  VT: 21, VA: 14, WA: 12, WV: 14, WI: 17, WY: 11,
};

/** Suggested ¢/kWh for a two-letter state code, or null if unknown. */
export function suggestedRateForState(state: string | null | undefined): number | null {
  if (!state) return null;
  return STATE_AVG_RATE_CENTS[state.trim().toUpperCase()] ?? null;
}
