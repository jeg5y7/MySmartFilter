import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — for external uptime monitoring (UptimeRobot etc.).
 * Verifies the app can reach the database. Deliberately terse: no
 * counts or internals — but it does name the deployed commit (short SHA,
 * public in the open-source-adjacent sense of "which build is live"),
 * which makes "did that deploy actually land?" an exact check after a
 * merge instead of an inference. Vercel injects VERCEL_GIT_COMMIT_SHA.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
