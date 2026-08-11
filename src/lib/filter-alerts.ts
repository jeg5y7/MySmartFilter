import type { Device } from "@prisma/client";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { resend, EMAIL_FROM } from "~/lib/resend";
import { dispatchWebhook } from "~/lib/webhooks";
import { getEffectiveFilterPreference } from "~/lib/filter-preference";

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Energy-cost trigger: fires when the cumulative extra electricity spent
 * pushing air through a loaded filter meets/exceeds the price of the
 * customer's preferred replacement. Creates a FilterAlert (deduped against
 * open alerts), emails the owner, marks it "notified" so the auto-order cron
 * can pick it up, and dispatches a filter.alert webhook.
 *
 * Returns the alert id, or null if nothing fired (no user, no preference,
 * cost below price, or an alert is already open).
 */
export async function maybeTriggerEnergyAlert(
  device: Device,
  currentPressure: number
): Promise<string | null> {
  if (!device.userId) return null;
  // Both blower types accrue cost now: ECM as direct blower watts, PSC as
  // the system-runtime penalty — the cost-vs-price trigger applies to both.

  const preference = await getEffectiveFilterPreference(device.userId, device.id);
  if (!preference) return null;

  const filterPrice = preference.filterProduct.price;
  if (device.extraEnergyCostCents < filterPrice) return null;

  // Dedupe against open alerts
  const existing = await db.filterAlert.findFirst({
    where: { deviceId: device.id, status: { in: ["pending", "notified"] } },
  });
  if (existing) return null;

  const autoOrderEnabled = preference.autoOrderEnabled;
  const autoOrderAt = autoOrderEnabled
    ? new Date(Date.now() + 24 * 60 * 60 * 1000)
    : null;

  const cancelToken = randomBytes(24).toString("hex");

  const alert = await db.filterAlert.create({
    data: {
      deviceId: device.id,
      userId: device.userId,
      pressure: currentPressure,
      threshold: device.pressureThreshold,
      status: "pending",
      autoOrderAt,
      cancelToken,
    },
  });

  void dispatchWebhook(device.userId, "filter.alert", {
    deviceId: device.deviceId,
    deviceName: device.name ?? device.deviceId,
    reason: "energy_cost",
    extraEnergyCostCents: Math.round(device.extraEnergyCostCents),
    filterPriceCents: filterPrice,
    runtimeHours: Math.round(device.runtimeHours),
    alertId: alert.id,
  });

  const user = await db.user.findUnique({
    where: { id: device.userId },
    select: { email: true },
  });

  if (user?.email) {
    const deviceName = device.name ?? device.deviceId;
    const autoOrderSection = autoOrderEnabled
      ? `<div style="background:#1e3a2f;border-left:3px solid #22c55e;padding:16px 20px;border-radius:6px;margin:20px 0;">
          <p style="margin:0;color:#86efac;font-size:14px;">
            🔄 A replacement filter will be automatically ordered in <strong>24 hours</strong>.
            <a href="https://mysmartfilter.com/api/alert/cancel?token=${cancelToken}" style="color:#4ade80;">Cancel this auto-order</a> with one click.
          </p>
        </div>`
      : `<div style="text-align:center;margin:28px 0;">
          <a href="https://mysmartfilter.com/store"
             style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Order Replacement Filter
          </a>
        </div>`;

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: user.email,
        subject: `💸 Your clogged filter now costs more than a new one — ${deviceName}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">Time to replace your filter</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        Your <strong style="color:#e2e8f0;">${deviceName}</strong> has now spent more on extra
        electricity pushing air through its clogged filter than a new filter costs.
        Replacing it saves you money from here on.
      </p>
      <div style="background:#0f172a;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Extra energy spent</td>
            <td style="color:#f87171;font-size:13px;text-align:right;font-weight:700;">${fmtUsd(device.extraEnergyCostCents)}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Replacement filter</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${fmtUsd(filterPrice)} — ${preference.filterProduct.size}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Blower runtime on this filter</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${Math.round(device.runtimeHours)} h</td>
          </tr>
        </table>
      </div>
      ${autoOrderSection}
    </div>
    <div style="background:#0f172a;padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
        You're receiving this because you have filter alerts enabled for this device.<br>
        <a href="https://mysmartfilter.com/settings/notifications" style="color:#64748b;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      console.error(`[energy-alert] email failed for device ${device.id}:`, err);
    }
  }

  await db.filterAlert.update({
    where: { id: alert.id },
    data: { status: "notified", notifiedAt: new Date() },
  });

  return alert.id;
}
