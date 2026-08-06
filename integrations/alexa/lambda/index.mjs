/**
 * MySmartFilter — Alexa Smart Home Skill lambda.
 *
 * Alexa requires smart-home skills to run through AWS Lambda; this function
 * is a thin translator: it takes Alexa directives, calls the MySmartFilter
 * bridge API with the account-linking access token Alexa supplies, and maps
 * the response into Alexa's device model.
 *
 * Exposed per monitor:
 *  - Alexa.TemperatureSensor  (duct temperature)
 *  - Alexa.RangeController    (instance "Monitor.FilterLife", 0–100 %)
 *  - Alexa.EndpointHealth     (online/offline)
 *
 * Deploy: Node.js 20.x runtime, handler "index.handler", no dependencies.
 */

const API_BASE = process.env.MYSMARTFILTER_API ?? "https://www.mysmartfilter.com";

async function fetchDevices(token) {
  const res = await fetch(`${API_BASE}/api/bridge/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw Object.assign(new Error("invalid token"), { code: "INVALID_AUTHORIZATION_CREDENTIAL" });
  if (!res.ok) throw new Error(`bridge api ${res.status}`);
  const body = await res.json();
  return body.data ?? [];
}

const uuid = () => crypto.randomUUID();

function discoveryEndpoint(d) {
  return {
    endpointId: d.id,
    manufacturerName: "MySmartFilter",
    description: "MySmartFilter smart filter monitor",
    friendlyName: d.name,
    displayCategories: ["TEMPERATURE_SENSOR"],
    capabilities: [
      {
        type: "AlexaInterface",
        interface: "Alexa.TemperatureSensor",
        version: "3",
        properties: {
          supported: [{ name: "temperature" }],
          proactivelyReported: false,
          retrievable: true,
        },
      },
      {
        type: "AlexaInterface",
        interface: "Alexa.RangeController",
        instance: "Monitor.FilterLife",
        version: "3",
        properties: {
          supported: [{ name: "rangeValue" }],
          proactivelyReported: false,
          retrievable: true,
          nonControllable: true,
        },
        capabilityResources: {
          friendlyNames: [
            { "@type": "text", value: { text: "Filter life", locale: "en-US" } },
          ],
        },
        configuration: {
          supportedRange: { minimumValue: 0, maximumValue: 100, precision: 1 },
          unitOfMeasure: "Alexa.Unit.Percent",
        },
      },
      {
        type: "AlexaInterface",
        interface: "Alexa.EndpointHealth",
        version: "3",
        properties: {
          supported: [{ name: "connectivity" }],
          proactivelyReported: false,
          retrievable: true,
        },
      },
      { type: "AlexaInterface", interface: "Alexa", version: "3" },
    ],
  };
}

function stateProperties(d) {
  const now = new Date().toISOString();
  const props = [
    {
      namespace: "Alexa.EndpointHealth",
      name: "connectivity",
      value: { value: d.online ? "OK" : "UNREACHABLE" },
      timeOfSample: now,
      uncertaintyInMilliseconds: 60000,
    },
  ];
  if (d.temperatureC !== null) {
    props.push({
      namespace: "Alexa.TemperatureSensor",
      name: "temperature",
      value: { value: d.temperatureC, scale: "CELSIUS" },
      timeOfSample: now,
      uncertaintyInMilliseconds: 60000,
    });
  }
  props.push({
    namespace: "Alexa.RangeController",
    instance: "Monitor.FilterLife",
    name: "rangeValue",
    value: d.filterLifePct ?? 0,
    timeOfSample: now,
    uncertaintyInMilliseconds: 60000,
  });
  return props;
}

function errorResponse(directive, type, message) {
  return {
    event: {
      header: {
        namespace: "Alexa",
        name: "ErrorResponse",
        messageId: uuid(),
        correlationToken: directive.header.correlationToken,
        payloadVersion: "3",
      },
      endpoint: directive.endpoint,
      payload: { type, message },
    },
  };
}

export const handler = async (event) => {
  const directive = event.directive;
  const { namespace, name } = directive.header;

  try {
    if (namespace === "Alexa.Authorization" && name === "AcceptGrant") {
      // Proactive-events grant — accepted; push reporting is a later phase
      return {
        event: {
          header: {
            namespace: "Alexa.Authorization",
            name: "AcceptGrant.Response",
            messageId: uuid(),
            payloadVersion: "3",
          },
          payload: {},
        },
      };
    }

    if (namespace === "Alexa.Discovery" && name === "Discover") {
      const token = directive.payload.scope.token;
      const devices = await fetchDevices(token);
      return {
        event: {
          header: {
            namespace: "Alexa.Discovery",
            name: "Discover.Response",
            messageId: uuid(),
            payloadVersion: "3",
          },
          payload: { endpoints: devices.map(discoveryEndpoint) },
        },
      };
    }

    if (namespace === "Alexa" && name === "ReportState") {
      const token = directive.endpoint.scope.token;
      const devices = await fetchDevices(token);
      const device = devices.find((d) => d.id === directive.endpoint.endpointId);
      if (!device) {
        return errorResponse(directive, "NO_SUCH_ENDPOINT", "unknown endpoint");
      }
      return {
        event: {
          header: {
            namespace: "Alexa",
            name: "StateReport",
            messageId: uuid(),
            correlationToken: directive.header.correlationToken,
            payloadVersion: "3",
          },
          endpoint: directive.endpoint,
          payload: {},
        },
        context: { properties: stateProperties(device) },
      };
    }

    // Monitors are read-only — reject any control directive
    return errorResponse(directive, "INVALID_DIRECTIVE", "read-only device");
  } catch (err) {
    if (err.code === "INVALID_AUTHORIZATION_CREDENTIAL") {
      return errorResponse(directive, "INVALID_AUTHORIZATION_CREDENTIAL", "relink the skill");
    }
    return errorResponse(directive, "INTERNAL_ERROR", String(err.message ?? err));
  }
};
