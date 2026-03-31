import { db } from "~/server/db";

/**
 * Validates a public API key from Authorization header (Bearer sk_live_...).
 * Returns the userId if valid, null otherwise.
 * Also bumps lastUsed timestamp.
 */
export async function validateApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer sk_live_")) return null;
  const key = authHeader.slice("Bearer ".length);

  const apiKey = await db.apiKey.findUnique({
    where: { key },
    select: { id: true, userId: true },
  });

  if (!apiKey) return null;

  // Fire-and-forget lastUsed update
  void db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return apiKey.userId;
}

/** Generates a new sk_live_ API key string */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_live_${hex}`;
}
