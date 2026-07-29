import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { resend, EMAIL_FROM } from "~/lib/resend";
import { getEffectiveFilterPreference } from "~/lib/filter-preference";

interface AlertRequest {
  deviceId: string;
  apiToken: string;
  pressure: number;
}

// ESP32 calls this when differential pressure exceeds threshold
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AlertRequest;
    const { deviceId, apiToken, pressure } = body;

    if (!deviceId || !apiToken || pressure === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: deviceId, apiToken, pressure" },
        { status: 400 }
      );
    }

    // Verify device and get user
    const device = await db.device.findUnique({
      where: { deviceId },
      include: { user: true },
    });

    if (!device || device.apiToken !== apiToken) {
      return NextResponse.json({ error: "Invalid device credentials" }, { status: 401 });
    }

    if (!device.userId || !device.user) {
      return NextResponse.json(
        { error: "Device not linked to a user account" },
        { status: 400 }
      );
    }

    // Check if pressure exceeds threshold
    if (pressure < device.pressureThreshold) {
      return NextResponse.json({
        alert: false,
        message: "Pressure within normal range",
        pressure,
        threshold: device.pressureThreshold,
      });
    }

    // Check for existing pending alert (avoid duplicates)
    const existingAlert = await db.filterAlert.findFirst({
      where: {
        deviceId: device.id,
        status: { in: ["pending", "notified"] },
      },
    });

    if (existingAlert) {
      return NextResponse.json({
        alert: true,
        message: "Alert already exists",
        alertId: existingAlert.id,
        status: existingAlert.status,
      });
    }

    // Check user's auto-order preference for this device
    // (device-specific row wins, else the user's default row)
    const preference = await getEffectiveFilterPreference(device.userId, device.id);

    const autoOrderEnabled = preference?.autoOrderEnabled ?? false;

    // Calculate auto-order time (24 hours from now if enabled)
    const autoOrderAt = autoOrderEnabled
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;

    // Create filter alert
    const alert = await db.filterAlert.create({
      data: {
        deviceId: device.id,
        userId: device.userId,
        pressure,
        threshold: device.pressureThreshold,
        status: "pending",
        autoOrderAt,
      },
    });

    // Send email notification to user via Resend
    const deviceName = device.name ?? device.deviceId;
    const userEmail = device.user.email;

    if (userEmail) {
      const autoOrderSection = autoOrderEnabled
        ? `<div style="background:#1e3a2f;border-left:3px solid #22c55e;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0;color:#86efac;font-size:14px;">
              🔄 A replacement filter will be automatically ordered in <strong>24 hours</strong>.
              Reply to this email or <a href="https://mysmartfilter.com/dashboard" style="color:#4ade80;">visit your dashboard</a> to cancel.
            </p>
          </div>`
        : `<div style="text-align:center;margin:28px 0;">
            <a href="https://mysmartfilter.com/store"
               style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
              Order Replacement Filter
            </a>
          </div>`;

      await resend.emails.send({
        from: EMAIL_FROM,
        to: userEmail,
        subject: `⚠️ Filter replacement needed — ${deviceName}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">Your filter needs attention</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        The pressure sensor on your <strong style="color:#e2e8f0;">${deviceName}</strong> has exceeded its threshold,
        indicating it's time to replace your filter.
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
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Current Pressure</td>
            <td style="color:#f87171;font-size:13px;text-align:right;font-weight:700;">${pressure.toFixed(1)} Pa</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Threshold</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${device.pressureThreshold.toFixed(1)} Pa</td>
          </tr>
        </table>
      </div>

      ${autoOrderSection}
    </div>

    <!-- Footer -->
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
    }

    console.log(`Filter alert created and email sent for user ${device.user.email}:`, {
      alertId: alert.id,
      deviceName,
      pressure,
      threshold: device.pressureThreshold,
      autoOrderEnabled,
      autoOrderAt,
    });

    // Update alert status to notified
    await db.filterAlert.update({
      where: { id: alert.id },
      data: { status: "notified", notifiedAt: new Date() },
    });

    return NextResponse.json({
      alert: true,
      alertId: alert.id,
      message: "Filter replacement alert created",
      autoOrderEnabled,
      autoOrderAt: autoOrderAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Filter alert error:", error);
    return NextResponse.json(
      { error: "Failed to process filter alert" },
      { status: 500 }
    );
  }
}

// Get pending alerts for a device
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const apiToken = url.searchParams.get("apiToken");

  if (!deviceId || !apiToken) {
    return NextResponse.json(
      { error: "Missing deviceId or apiToken" },
      { status: 400 }
    );
  }

  const device = await db.device.findUnique({
    where: { deviceId },
  });

  if (!device || device.apiToken !== apiToken) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const alerts = await db.filterAlert.findMany({
    where: {
      deviceId: device.id,
      status: { in: ["pending", "notified"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ alerts });
}
