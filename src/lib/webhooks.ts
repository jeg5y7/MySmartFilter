import { db } from "~/server/db";
import { createHmac } from "crypto";

export type WebhookEvent =
  | "filter.alert"
  | "device.offline"
  | "reading.threshold";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Dispatch a webhook event to all enabled webhooks for a user that subscribe to it.
 * Fires in the background — does not throw.
 */
export async function dispatchWebhook(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await db.webhook.findMany({
      where: {
        userId,
        enabled: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      webhooks.map((wh) => deliverWebhook(wh.id, wh.url, wh.secret, event, body, payload))
    );
  } catch (err) {
    console.error("[webhooks] dispatchWebhook error:", err);
  }
}

async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: WebhookEvent,
  body: string,
  payload: WebhookPayload
): Promise<void> {
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  let statusCode: number | null = null;
  let response: string | null = null;
  let status = "failed";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SmartFilter-Event": event,
        "X-SmartFilter-Signature": `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = res.status;
    response = await res.text().catch(() => null);
    status = res.ok ? "success" : "failed";
  } catch (err) {
    response = err instanceof Error ? err.message : String(err);
  }

  await db.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: payload as object,
      status,
      statusCode,
      response: response?.slice(0, 1000) ?? null,
    },
  });
}
