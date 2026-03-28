import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

/**
 * Parse a semver string into [major, minor, patch] numbers.
 */
function parseSemver(version: string): [number, number, number] {
  const parts = version.replace(/^v/, "").split(".").map(Number);
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
