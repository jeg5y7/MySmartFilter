import { type NextRequest, NextResponse } from "next/server";
import { validateOAuthBearer } from "~/lib/oauth";
import { getBridgeDevices } from "~/lib/bridge";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

/**
 * GET /api/bridge/devices — normalized device list for smart-home
 * connectors that pull over HTTPS (the Alexa lambda uses this).
 * Auth: OAuth Bearer access token from account linking.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const rl = rateLimit(`bridge:${authHeader ?? clientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  const grant = await validateOAuthBearer(authHeader);
  if (!grant) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const devices = await getBridgeDevices(grant.userId);
  return NextResponse.json({ data: devices });
}
