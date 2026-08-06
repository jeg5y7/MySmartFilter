import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { validateClientRedirect, issueAuthorizationCode } from "~/lib/oauth";

/**
 * POST /api/oauth/decision — target of the consent form on /oauth/authorize.
 * Re-validates everything server-side, then redirects back to the platform
 * with either an authorization code or access_denied.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", request.url), 303);
  }

  const form = await request.formData();
  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const clientId = str("client_id");
  const redirectUri = str("redirect_uri");
  const state = str("state");
  const decision = str("decision");

  // Validate again — never trust the hidden fields on their own
  const client = await validateClientRedirect(clientId, redirectUri);
  if (!client) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400 }
    );
  }

  const target = new URL(redirectUri);
  if (state) target.searchParams.set("state", state);

  if (decision !== "approve") {
    target.searchParams.set("error", "access_denied");
    return NextResponse.redirect(target, 303);
  }

  const code = await issueAuthorizationCode({
    clientDbId: client.id,
    userId: session.user.id,
    redirectUri,
  });
  target.searchParams.set("code", code);
  return NextResponse.redirect(target, 303);
}
