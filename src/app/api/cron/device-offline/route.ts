import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { resend, EMAIL_FROM } from "~/lib/resend";
import { dispatchWebhook } from "~/lib/webhooks";
import { env } from "~/env";

/**
 * Vercel Cron — schedule-agnostic offline sweep.
 * Finds devices silent for >15 min that aren't already "offline", marks them
 * offline, and emails the owner once. The `status != offline` filter is what
 * prevents duplicate emails, so this works on any cron cadence (daily on the
 * Hobby plan; run it every 15 min on Pro for timely alerts).
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel standard: Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  try {
    // Any device silent for >15 min that hasn't been marked offline yet
    const devicesGoingOffline = await db.device.findMany({
      where: {
        lastSeen: { lte: fifteenMinutesAgo },
        // "pending" devices were never linked — leave them out of the sweep
        status: { notIn: ["offline", "pending"] },
      },
      include: { user: true },
    });

    if (devicesGoingOffline.length === 0) {
      return NextResponse.json({ checked: true, offlineCount: 0, message: "No new offline devices" });
    }

    const results: { deviceId: string; emailSent: boolean; error?: string }[] = [];

    for (const device of devicesGoingOffline) {
      // Mark device offline
      await db.device.update({
        where: { id: device.id },
        data: { status: "offline" },
      });

      const deviceName = device.name ?? device.deviceId;
      const userEmail = device.user?.email;

      // Dispatch device.offline webhook regardless of email
      if (device.userId) {
        void dispatchWebhook(device.userId, "device.offline", {
          deviceId: device.deviceId,
          deviceName: device.name ?? device.deviceId,
          lastSeen: device.lastSeen,
        });
      }

      if (!userEmail) {
        results.push({ deviceId: device.id, emailSent: false, error: "No user email" });
        continue;
      }

      const lastSeenFormatted = device.lastSeen.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: userEmail,
          subject: `📡 Your Smart Filter device is offline — ${deviceName}`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">📡 Device offline</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        We haven't heard from <strong style="color:#e2e8f0;">${deviceName}</strong> in a while.
        It may be unplugged, out of range, or experiencing a connection issue.
      </p>

      <!-- Device info -->
      <div style="background:#0f172a;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Device</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;font-weight:600;">${deviceName}</td>
          </tr>
          ${device.location ? `<tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Location</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${device.location}</td>
          </tr>` : ""}
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Last seen</td>
            <td style="color:#fbbf24;font-size:13px;text-align:right;">${lastSeenFormatted}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Status</td>
            <td style="color:#f87171;font-size:13px;text-align:right;font-weight:700;">Offline</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="https://mysmartfilter.com/devices/${device.id}"
           style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Check Your Device
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;margin-bottom:0;">
        If you recently powered it off on purpose, you can ignore this message.
        Once it reconnects, its status will automatically update.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0f172a;padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
        You're receiving this because you have device alerts enabled.<br>
        <a href="https://mysmartfilter.com/settings/notifications" style="color:#64748b;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
        });

        results.push({ deviceId: device.id, emailSent: true });
      } catch (emailError) {
        console.error(`Failed to send offline email for device ${device.id}:`, emailError);
        results.push({ deviceId: device.id, emailSent: false, error: "Email send failed" });
      }
    }

    console.log(`[cron/device-offline] Processed ${devicesGoingOffline.length} offline devices:`, results);

    return NextResponse.json({
      checked: true,
      offlineCount: devicesGoingOffline.length,
      results,
    });
  } catch (error) {
    console.error("[cron/device-offline] Error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
