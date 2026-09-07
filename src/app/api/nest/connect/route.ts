import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { nestConfigured, nestAuthUrl } from "~/lib/nest";

/**
 * GET /api/nest/connect — start the Google Nest OAuth flow.
 * Requires a signed-in user; sets a CSRF state cookie and redirects to the
 * SDM Partner Connections consent screen.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }
  if (!nestConfigured()) {
    return NextResponse.json(
      { error: "Nest integration is not configured yet" },
      { status: 503 }
    );
  }

  const origin = env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const redirectUri = `${origin}/api/nest/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(nestAuthUrl(redirectUri, state));
  res.cookies.set("nest_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/nest",
  });
  return res;
}
