import { createHash } from "crypto";
import { db } from "~/server/db";

/**
 * OAuth2 authorization-server core for smart-home account linking
 * (Google Home / Alexa / SmartThings cloud-to-cloud).
 *
 * Only secret *hashes* are stored; raw codes/tokens exist client-side only.
 * Grants: authorization_code (10-min single-use codes) and refresh_token.
 * Access tokens live 1 hour; refresh tokens live until revoked/rotated.
 */

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OAUTH_SCOPE = "devices:read";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Look up a client and verify its redirect URI against the allowlist. */
export async function validateClientRedirect(
  clientId: string,
  redirectUri: string
) {
  const client = await db.oAuthClient.findUnique({
    where: { clientId },
  });
  if (!client) return null;
  if (!client.redirectUris.includes(redirectUri)) return null;
  return client;
}

/** Verify client credentials (used by the token endpoint). */
export async function authenticateClient(
  clientId: string,
  clientSecret: string
) {
  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client) return null;
  if (client.clientSecretHash !== sha256(clientSecret)) return null;
  return client;
}

/** Issue a single-use authorization code after user consent. */
export async function issueAuthorizationCode(opts: {
  clientDbId: string;
  userId: string;
  redirectUri: string;
}): Promise<string> {
  const code = `ac_${randomHex(32)}`;
  await db.oAuthAuthorizationCode.create({
    data: {
      codeHash: sha256(code),
      clientId: opts.clientDbId,
      userId: opts.userId,
      redirectUri: opts.redirectUri,
      scope: OAUTH_SCOPE,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return code;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
}

async function createTokenPair(
  clientDbId: string,
  userId: string,
  scope: string
): Promise<IssuedTokens> {
  const accessToken = `at_${randomHex(32)}`;
  const refreshToken = `rt_${randomHex(32)}`;
  await db.oAuthToken.create({
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      clientId: clientDbId,
      userId,
      scope,
      accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    },
  });
  return {
    accessToken,
    refreshToken,
    expiresInSeconds: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope,
  };
}

/** Exchange an authorization code (single-use, expiring) for tokens. */
export async function exchangeAuthorizationCode(opts: {
  clientDbId: string;
  code: string;
  redirectUri: string;
}): Promise<IssuedTokens | null> {
  const record = await db.oAuthAuthorizationCode.findUnique({
    where: { codeHash: sha256(opts.code) },
  });
  if (
    !record ||
    record.clientId !== opts.clientDbId ||
    record.redirectUri !== opts.redirectUri ||
    record.usedAt !== null ||
    record.expiresAt < new Date()
  ) {
    return null;
  }
  await db.oAuthAuthorizationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return createTokenPair(record.clientId, record.userId, record.scope);
}

/** Rotate a refresh token: revoke the old pair, mint a new one. */
export async function exchangeRefreshToken(opts: {
  clientDbId: string;
  refreshToken: string;
}): Promise<IssuedTokens | null> {
  const record = await db.oAuthToken.findUnique({
    where: { refreshTokenHash: sha256(opts.refreshToken) },
  });
  if (!record || record.clientId !== opts.clientDbId || record.revokedAt) {
    return null;
  }
  await db.oAuthToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  return createTokenPair(record.clientId, record.userId, record.scope);
}

/**
 * Validate a Bearer access token from a bridge request.
 * Returns the owning user + client, or null.
 */
export async function validateOAuthBearer(
  authHeader: string | null
): Promise<{ userId: string; clientDbId: string } | null> {
  if (!authHeader?.startsWith("Bearer at_")) return null;
  const token = authHeader.slice("Bearer ".length);
  const record = await db.oAuthToken.findUnique({
    where: { accessTokenHash: sha256(token) },
    select: {
      id: true,
      userId: true,
      clientId: true,
      accessExpiresAt: true,
      revokedAt: true,
    },
  });
  if (!record || record.revokedAt || record.accessExpiresAt < new Date()) {
    return null;
  }
  void db.oAuthToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { userId: record.userId, clientDbId: record.clientId };
}

/** Revoke every token a client holds for a user (DISCONNECT / unlink). */
export async function revokeUserClientTokens(
  userId: string,
  clientDbId: string
): Promise<number> {
  const res = await db.oAuthToken.updateMany({
    where: { userId, clientId: clientDbId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
