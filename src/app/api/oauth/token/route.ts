import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateClient,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
} from "~/lib/oauth";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

/**
 * POST /api/oauth/token — RFC 6749 token endpoint.
 * Grants: authorization_code, refresh_token.
 * Client auth: HTTP Basic or client_id/client_secret in the form body
 * (Google, Alexa, and SmartThings each use one of the two).
 */

function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function oauthError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`oauth-token:${clientIp(request)}`, 30, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", 400);
  }

  // Client credentials: Basic header wins, body params as fallback
  let clientId = formString(form, "client_id");
  let clientSecret = formString(form, "client_secret");
  const basic = request.headers.get("authorization");
  if (basic?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(basic.slice(6), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep > 0) {
        clientId = decodeURIComponent(decoded.slice(0, sep));
        clientSecret = decodeURIComponent(decoded.slice(sep + 1));
      }
    } catch {
      return oauthError("invalid_client", 401);
    }
  }
  if (!clientId || !clientSecret) return oauthError("invalid_client", 401);

  const client = await authenticateClient(clientId, clientSecret);
  if (!client) return oauthError("invalid_client", 401);

  const grantType = formString(form, "grant_type");

  if (grantType === "authorization_code") {
    const code = formString(form, "code");
    const redirectUri = formString(form, "redirect_uri");
    if (!code || !redirectUri) return oauthError("invalid_request", 400);

    const tokens = await exchangeAuthorizationCode({
      clientDbId: client.id,
      code,
      redirectUri,
    });
    if (!tokens) return oauthError("invalid_grant", 400);

    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresInSeconds,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = formString(form, "refresh_token");
    if (!refreshToken) return oauthError("invalid_request", 400);

    const tokens = await exchangeRefreshToken({
      clientDbId: client.id,
      refreshToken,
    });
    if (!tokens) return oauthError("invalid_grant", 400);

    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresInSeconds,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return oauthError("unsupported_grant_type", 400);
}
