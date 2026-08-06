import { type NextRequest, NextResponse } from "next/server";
import { validateOAuthBearer, revokeUserClientTokens } from "~/lib/oauth";
import { getBridgeDevices, type BridgeDevice } from "~/lib/bridge";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

/**
 * POST /api/bridge/smartthings — SmartThings Schema (ST Schema) connector.
 * SmartThings POSTs interaction requests here carrying the OAuth access
 * token it obtained through our account-linking flow.
 *
 * Capabilities exposed per monitor: filterStatus, temperatureMeasurement,
 * battery, healthCheck.
 */

interface StRequest {
  headers?: {
    schema?: string;
    version?: string;
    interactionType?: string;
    requestId?: string;
  };
  authentication?: { tokenType?: string; token?: string };
}

function stHeaders(interactionType: string, requestId: string) {
  return {
    schema: "st-schema",
    version: "1.0",
    interactionType,
    requestId,
  };
}

function deviceStates(d: BridgeDevice) {
  const states: Array<Record<string, unknown>> = [
    {
      component: "main",
      capability: "st.healthCheck",
      attribute: "healthStatus",
      value: d.online ? "online" : "offline",
    },
    {
      component: "main",
      capability: "st.filterStatus",
      attribute: "filterStatus",
      value: d.filterStatus === "replace_now" ? "replace" : "normal",
    },
  ];
  if (d.temperatureC !== null) {
    states.push({
      component: "main",
      capability: "st.temperatureMeasurement",
      attribute: "temperature",
      value: Math.round(d.temperatureC * 10) / 10,
      unit: "C",
    });
  }
  if (d.batteryPct !== null) {
    states.push({
      component: "main",
      capability: "st.battery",
      attribute: "battery",
      value: Math.round(d.batteryPct),
    });
  }
  return { externalDeviceId: d.id, states };
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`bridge-st:${clientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  let body: StRequest;
  try {
    body = (await req.json()) as StRequest;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const interactionType = body.headers?.interactionType ?? "";
  const requestId = body.headers?.requestId ?? "";
  const token = body.authentication?.token ?? "";

  const grant = await validateOAuthBearer(token ? `Bearer ${token}` : null);
  if (!grant) {
    return NextResponse.json(
      {
        headers: stHeaders("interactionResult", requestId),
        globalError: { errorEnum: "TOKEN-EXPIRED", detail: "invalid or expired token" },
      },
      { status: 401 }
    );
  }

  if (interactionType === "discoveryRequest") {
    const devices = await getBridgeDevices(grant.userId);
    return NextResponse.json({
      headers: stHeaders("discoveryResponse", requestId),
      devices: devices.map((d) => ({
        externalDeviceId: d.id,
        friendlyName: d.name,
        manufacturerInfo: {
          manufacturerName: "MySmartFilter",
          modelName: "smart filter monitor",
          hwVersion: "1.0",
          swVersion: "1.0",
        },
        deviceContext: {
          roomName: "HVAC",
          categories: ["others"],
        },
      })),
    });
  }

  if (interactionType === "stateRefreshRequest") {
    const devices = await getBridgeDevices(grant.userId);
    return NextResponse.json({
      headers: stHeaders("stateRefreshResponse", requestId),
      deviceState: devices.map(deviceStates),
    });
  }

  if (interactionType === "commandRequest") {
    // Monitors are read-only — report current state, no commands accepted
    const devices = await getBridgeDevices(grant.userId);
    return NextResponse.json({
      headers: stHeaders("commandResponse", requestId),
      deviceState: devices.map(deviceStates),
    });
  }

  if (interactionType === "grantCallbackAccess") {
    // Proactive state-push callback tokens — planned; acknowledge for now
    return NextResponse.json({
      headers: stHeaders("interactionResult", requestId),
    });
  }

  if (interactionType === "integrationDeleted") {
    await revokeUserClientTokens(grant.userId, grant.clientDbId);
    return NextResponse.json({
      headers: stHeaders("interactionResult", requestId),
    });
  }

  return NextResponse.json(
    {
      headers: stHeaders("interactionResult", requestId),
      globalError: { errorEnum: "BAD-REQUEST", detail: `unsupported interactionType: ${interactionType}` },
    },
    { status: 400 }
  );
}
