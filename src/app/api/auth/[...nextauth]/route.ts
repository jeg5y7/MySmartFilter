import { type NextRequest } from "next/server";
import { handlers } from "~/server/auth";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

export const GET = handlers.GET;

/**
 * Magic-link sign-in sends an email per request — without a limit, a bot
 * could email-bomb any address or burn through our email quota.
 */
export async function POST(req: NextRequest) {
  if (req.nextUrl.pathname.includes("/signin")) {
    const rl = rateLimit(`magiclink:${clientIp(req)}`, 5, 15 * 60 * 1000);
    if (!rl.ok) return tooManyRequests(rl);
  }
  return handlers.POST(req);
}
