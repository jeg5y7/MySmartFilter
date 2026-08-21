import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * One-click self-repair for the FirmwareRelease table.
 *
 * The OTA feature's DDL was never applied to production (and the Neon
 * console's habit of opening the stale us-east-1 project makes running it
 * by hand error-prone). This runs the idempotent CREATE through the app's
 * own DATABASE_URL, which by construction targets the right database.
 * Admin-only; safe to call repeatedly.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FirmwareRelease" (
      "id" TEXT NOT NULL,
      "version" TEXT NOT NULL,
      "binaryUrl" TEXT NOT NULL,
      "releaseNotes" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "rolloutPct" INTEGER NOT NULL DEFAULT 100,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FirmwareRelease_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FirmwareRelease_version_key" ON "FirmwareRelease"("version")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FirmwareRelease_isActive_idx" ON "FirmwareRelease"("isActive")`
  );

    const count = await db.firmwareRelease.count();
    return NextResponse.json({ ok: true, releases: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/firmware/schema] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
