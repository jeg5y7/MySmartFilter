import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { resend, EMAIL_FROM } from "~/lib/resend";
import { env } from "~/env";

/**
 * Vercel Cron — runs every hour.
 * Finds FilterAlert records where status = "notified" and autoOrderAt <= now,
 * creates an Order for each, and sends a confirmation email.
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel standard: Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // Find alerts ready for auto-order
    const pendingAlerts = await db.filterAlert.findMany({
      where: {
        status: "notified",
        autoOrderAt: { lte: now },
      },
      include: {
        device: {
          include: {
            filterPreferences: {
              where: { autoOrderEnabled: true },
              include: { filterProduct: true },
              orderBy: { deviceId: "desc" }, // device-specific preference first
              take: 1,
            },
          },
        },
        user: true,
      },
    });

    if (pendingAlerts.length === 0) {
      return NextResponse.json({ processed: 0, message: "No auto-orders due" });
    }

    const results: { alertId: string; orderId?: string; emailSent: boolean; error?: string }[] = [];

    for (const alert of pendingAlerts) {
      const preference = alert.device.filterPreferences[0];
      const userEmail = alert.user.email;
      const deviceName = alert.device.name ?? alert.device.deviceId;

      try {
        let order;

        if (preference?.filterProduct) {
          const product = preference.filterProduct;
          // Create order with the preferred filter product
          order = await db.order.create({
            data: {
              userId: alert.userId,
              isAutoOrder: true,
              triggeredByAlertId: alert.id,
              status: "pending",
              subtotal: product.price,
              tax: 0,
              shipping: 0,
              total: product.price,
              orderItems: {
                create: {
                  filterProductId: product.id,
                  quantity: 1,
                  priceAtPurchase: product.price,
                },
              },
            },
          });
        } else {
          // No product preference found — create a placeholder order for manual fulfillment
          order = await db.order.create({
            data: {
              userId: alert.userId,
              isAutoOrder: true,
              triggeredByAlertId: alert.id,
              status: "pending",
              subtotal: 0,
              tax: 0,
              shipping: 0,
              total: 0,
            },
          });
        }

        // Mark alert as auto_ordered
        await db.filterAlert.update({
          where: { id: alert.id },
          data: {
            status: "auto_ordered",
            resolvedAt: new Date(),
          },
        });

        // Send confirmation email
        if (userEmail) {
          const productName = preference?.filterProduct?.name ?? "your filter";
          const productSize = preference?.filterProduct?.size;
          const totalCents = order.total;
          const totalFormatted = totalCents > 0
            ? `$${(totalCents / 100).toFixed(2)}`
            : "TBD";

          await resend.emails.send({
            from: EMAIL_FROM,
            to: userEmail,
            subject: `✅ Your replacement filter has been ordered — ${deviceName}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;">✅ Filter order confirmed</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:15px;margin-top:0;">
        Your replacement filter for <strong style="color:#e2e8f0;">${deviceName}</strong> has been
        automatically ordered as scheduled.
      </p>

      <!-- Order info -->
      <div style="background:#0f172a;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Order #</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;font-family:monospace;">${order.id.slice(-8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Device</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;font-weight:600;">${deviceName}</td>
          </tr>
          ${alert.device.location ? `<tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Location</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${alert.device.location}</td>
          </tr>` : ""}
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Item</td>
            <td style="color:#e2e8f0;font-size:13px;text-align:right;">${productName}${productSize ? ` (${productSize})` : ""}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Total</td>
            <td style="color:#4ade80;font-size:13px;text-align:right;font-weight:700;">${totalFormatted}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Status</td>
            <td style="color:#86efac;font-size:13px;text-align:right;">Processing</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="https://mysmartfilter.com/orders/${order.id}"
           style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          View Order Details
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;margin-bottom:0;">
        You'll receive a shipping notification once your order ships.
        To manage auto-order settings, <a href="https://mysmartfilter.com/settings" style="color:#94a3b8;">visit your settings</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0f172a;padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
        This order was placed automatically based on your filter preferences.<br>
        <a href="https://mysmartfilter.com/settings/notifications" style="color:#64748b;">Manage auto-order settings</a>
      </p>
    </div>
  </div>
</body>
</html>`,
          });

          results.push({ alertId: alert.id, orderId: order.id, emailSent: true });
        } else {
          results.push({ alertId: alert.id, orderId: order.id, emailSent: false, error: "No user email" });
        }
      } catch (alertError) {
        console.error(`[cron/auto-order] Failed to process alert ${alert.id}:`, alertError);
        results.push({ alertId: alert.id, emailSent: false, error: "Processing failed" });
      }
    }

    console.log(`[cron/auto-order] Processed ${pendingAlerts.length} auto-orders:`, results);

    return NextResponse.json({
      processed: pendingAlerts.length,
      results,
    });
  } catch (error) {
    console.error("[cron/auto-order] Error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
