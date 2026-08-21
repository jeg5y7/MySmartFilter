import { createHash } from "crypto";
import { db } from "~/server/db";

/**
 * API keys are stored HASHED at rest ("sha256:<hex>"), so a database leak
 * doesn't expose usable keys. Rows created before hashing shipped hold the
 * raw key — they're upgraded in place the first time they're used.
 */
export function hashApiKey(rawKey: string): string {
  return "sha256:" + createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Validates a public API key from Authorization header (Bearer sk_live_...).
 * Returns the userId if valid, null otherwise. Bumps lastUsed.
 */
export async function validateApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer sk_live_")) return null;
  const key = authHeader.slice("Bearer ".length);

  let apiKey = await db.apiKey.findUnique({
    where: { key: hashApiKey(key) },
    select: { id: true, userId: true },
  });

  if (!apiKey) {
    // Legacy row still holding the raw key — validate, then upgrade it
    const legacy = await db.apiKey.findUnique({
      where: { key },
      select: { id: true, userId: true },
    });
    if (!legacy) return null;
    await db.apiKey.update({
      where: { id: legacy.id },
      data: { key: hashApiKey(key) },
    });
    apiKey = legacy;
  }

  // Fire-and-forget lastUsed update
  void db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return apiKey.userId;
}

/** Generates a new sk_live_ API key string (shown to the user exactly once). */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_live_${hex}`;
}
