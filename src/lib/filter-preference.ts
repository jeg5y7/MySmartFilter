import { db } from "~/server/db";
import type { FilterProduct, UserFilterPreference } from "@prisma/client";

export type PreferenceWithProduct = UserFilterPreference & {
  filterProduct: FilterProduct;
};

/**
 * Resolve the filter preference that applies to a device: the device-specific
 * row if one exists, otherwise the user's default (deviceId = null) row.
 *
 * `deviceId` is the Device cuid (Device.id), matching UserFilterPreference.deviceId.
 */
export async function getEffectiveFilterPreference(
  userId: string,
  deviceId: string
): Promise<PreferenceWithProduct | null> {
  const prefs = await db.userFilterPreference.findMany({
    where: {
      userId,
      OR: [{ deviceId }, { deviceId: null }],
    },
    include: { filterProduct: true },
  });

  return (
    prefs.find((p) => p.deviceId === deviceId) ??
    prefs.find((p) => p.deviceId === null) ??
    null
  );
}
