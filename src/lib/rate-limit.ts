/**
 * In-memory fixed-window rate limiter.
 *
 * Scope: per serverless instance. Under Vercel, concurrent instances each
 * have their own window, so real-world limits are (limit × instances) — good
 * enough to stop naive abuse and runaway devices at launch. Swap for a
 * shared store (Upstash/Postgres) when traffic justifies it.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Periodically drop expired windows so the map can't grow unbounded
const SWEEP_EVERY = 5 * 60 * 1000;
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Count a hit against `key` (e.g. "sensor:<token>" or "register:<ip>").
 * Allows `limit` hits per `windowMs`, then rejects until the window resets.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_EVERY) {
    lastSweep = now;
    for (const [k, w] of windows) {
      if (w.resetAt <= now) windows.delete(k);
    }
  }

  const win = windows.get(key);
  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - win.count, retryAfterSeconds: 0 };
}

/** Best-effort client IP from Vercel/proxy headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}

/** Standard 429 JSON response. */
export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    }
  );
}
