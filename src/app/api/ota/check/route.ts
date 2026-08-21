import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "~/server/db";

/**
 * Deterministic 0–99 bucket per device for staged rollouts: the same
 * device always lands in the same bucket, so raising rolloutPct only ever
 * ADDS devices to the eligible set.
 */
function rolloutBucket(deviceId: string): number {
  const h = createHash("sha256").update(deviceId).digest();
  return ((h[0]! << 8) | h[1]!) % 100;
}

/**
 * Parse a semver string into [major, minor, patch] numbers. parseInt (not
 * Number) so suffixed components like the "1-usb" in "1.10.1-usb" parse as
 * 1 instead of NaN — NaN comparisons silently made patch-level updates
 * invisible to the fleet.
 */
function parseSemver(version: string): [number, number, number] {
  const parts = version
    .replace(/^v/, "")
    .split(".")
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isNaN(n) ? 0 : n;
    });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Returns true if `available` is strictly newer than `current`.
 */
function isNewer(available: string, current: string): boolean {
  const [amaj, amin, apatch] = parseSemver(available);
  const [cmaj, cmin, cpatch] = parseSemver(current);
  if (amaj !== cmaj) return amaj > cmaj;
  if (amin !== cmin) return amin > cmin;
  return apatch > cpatch;
}

/**
 * GET /api/ota/check
 *
 * Called by ESP32 on boot to check for firmware updates.
 * Auth: Bearer <apiToken>
 * Query param: version=<current_firmware_version> (optional, falls back to DB value)
 *
 * Response:
 *   { hasUpdate: false }
 *   { hasUpdate: true, version: "1.2.0", binaryUrl: "https://..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.substring(7);
    const device = await db.device.findUnique({ where: { apiToken } });

    if (!device) {
      return NextResponse.json(
        { error: "Invalid API token" },
        { status: 401 }
      );
    }

    // Use version from query param if provided, otherwise fall back to DB
    const queryVersion = request.nextUrl.searchParams.get("version");
    const deviceVersion = queryVersion ?? device.firmware ?? "0.0.0";

    // Update stored firmware version if device is reporting a different one
    if (queryVersion && queryVersion !== device.firmware) {
      await db.device.update({
        where: { id: device.id },
        data: { firmware: queryVersion, lastSeen: new Date() },
      });
    }

    // Find the latest active release
    const latestRelease = await db.firmwareRelease.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRelease) {
      return NextResponse.json({ hasUpdate: false });
    }

    // Staged rollout: only the release's eligible fraction of the fleet
    if (rolloutBucket(device.deviceId) >= latestRelease.rolloutPct) {
      return NextResponse.json({ hasUpdate: false });
    }

    if (isNewer(latestRelease.version, deviceVersion)) {
      console.log(
        `[OTA] Device ${device.deviceId} on ${deviceVersion} — update available: ${latestRelease.version}`
      );
      return NextResponse.json({
        hasUpdate: true,
        version: latestRelease.version,
        binaryUrl: latestRelease.binaryUrl,
      });
    }

    return NextResponse.json({ hasUpdate: false });
  } catch (error) {
    console.error("[OTA] Error in /api/ota/check:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
