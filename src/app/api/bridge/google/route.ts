import { type NextRequest, NextResponse } from "next/server";
import { validateOAuthBearer, revokeUserClientTokens } from "~/lib/oauth";
import { getBridgeDevices, type BridgeDevice } from "~/lib/bridge";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

/**
 * POST /api/bridge/google — Google Home cloud-to-cloud fulfillment.
 * Handles SYNC / QUERY / EXECUTE / DISCONNECT intents.
 * Auth: OAuth Bearer access token issued by our account-linking flow.
 *
 * Devices surface as SENSOR with the SensorState trait:
 * FilterCleanliness (descriptive) + FilterLifeTime (percentage).
 */

interface GoogleIntentRequest {
  requestId?: string;
  inputs?: { intent?: string }[];
}

function cleanliness(d: BridgeDevice): string {
  switch (d.filterStatus) {
    case "ok":
      return "clean";
    case "replace_soon":
      return "dirty";
    case "replace_now":
      return "needs replacement";
    default:
      return "unknown";
  }
}

function syncDevice(d: BridgeDevice) {
  return {
    id: d.id,
    type: "action.devices.types.SENSOR",
    traits: ["action.devices.traits.SensorState"],
    name: {
      name: d.name,
      defaultNames: ["MySmartFilter smart filter monitor"],
      nicknames: [d.name],
    },
    willReportState: false,
    roomHint: undefined,
    deviceInfo: {
      manufacturer: "MySmartFilter",
      model: "smart filter monitor",
    },
    attributes: {
      sensorStatesSupported: [
        {
          name: "FilterCleanliness",
          descriptiveCapabilities: {
            availableStates: ["clean", "dirty", "needs replacement", "unknown"],
          },
        },
        {
          name: "FilterLifeTime",
          numericCapabilities: { rawValueUnit: "PERCENTAGE" },
        },
      ],
    },
  };
}

function queryState(d: BridgeDevice) {
  return {
    online: d.online,
    status: "SUCCESS",
    currentSensorStateData: [
      {
        name: "FilterCleanliness",
        currentSensorState: cleanliness(d),
      },
      {
        name: "FilterLifeTime",
        rawValue: d.filterLifePct ?? 0,
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const rl = rateLimit(`bridge:${authHeader ?? clientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  const grant = await validateOAuthBearer(authHeader);
  if (!grant) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  let body: GoogleIntentRequest;
  try {
    body = (await req.json()) as GoogleIntentRequest;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const requestId = body.requestId ?? "";
  const intent = body.inputs?.[0]?.intent ?? "";

  if (intent === "action.devices.SYNC") {
    const devices = await getBridgeDevices(grant.userId);
    return NextResponse.json({
      requestId,
      payload: {
        agentUserId: grant.userId,
        devices: devices.map(syncDevice),
      },
    });
  }

  if (intent === "action.devices.QUERY") {
    const devices = await getBridgeDevices(grant.userId);
    const states: Record<string, unknown> = {};
    for (const d of devices) states[d.id] = queryState(d);
    return NextResponse.json({ requestId, payload: { devices: states } });
  }

  if (intent === "action.devices.EXECUTE") {
    // Monitors are read-only sensors — nothing is executable.
    return NextResponse.json({
      requestId,
      payload: {
        commands: [{ ids: [], status: "ERROR", errorCode: "actionNotAvailable" }],
      },
    });
  }

  if (intent === "action.devices.DISCONNECT") {
    await revokeUserClientTokens(grant.userId, grant.clientDbId);
    return NextResponse.json({});
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
