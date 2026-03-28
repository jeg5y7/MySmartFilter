import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

/**
 * GET /api/ota/download/[version]
 *
 * Redirects to the firmware binary URL for the requested version.
 * Auth: Bearer <apiToken>
 *
 * Used by ESP32 HTTPUpdate to fetch the firmware binary. Redirects to
 * the binaryUrl stored in the FirmwareRelease record (e.g. GitHub Releases).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
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

    const { version } = await params;
    const release = await db.firmwareRelease.findFirst({
      where: { version, isActive: true },
    });

    if (!release) {
      return NextResponse.json(
        { error: `Firmware version ${version} not found or inactive` },
        { status: 404 }
      );
    }

    console.log(
      `[OTA] Device ${device.deviceId} downloading firmware ${version}`
    );

    // Redirect to the actual binary (GitHub Releases, S3, etc.)
    return NextResponse.redirect(release.binaryUrl, 302);
  } catch (error) {
    console.error("[OTA] Error in /api/ota/download:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
