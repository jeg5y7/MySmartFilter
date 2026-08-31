import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { resend, EMAIL_FROM, escapeHtml } from "~/lib/resend";
import { env } from "~/env";
import { getEffectiveFilterPreference } from "~/lib/filter-preference";
import { stripe } from "~/lib/stripe";

// Flat standard shipping, matches the store checkout option
const AUTO_ORDER_SHIPPING_CENTS = 599;

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
        device: true,
        user: true,
      },
    });

    if (pendingAlerts.length === 0) {
      return NextResponse.json({ processed: 0, message: "No auto-orders due" });
    }

    const results: { alertId: string; orderId?: string; emailSent: boolean; error?: string }[] = [];

    for (const alert of pendingAlerts) {
      // Device-specific preference wins, else the user's default; only
      // preferences with auto-order enabled qualify.
      const resolved = await getEffectiveFilterPreference(alert.userId, alert.deviceId);
      const preference = resolved?.autoOrderEnabled ? resolved : undefined;
      const userEmail = alert.user.email;
      const deviceName = escapeHtml(alert.device.name ?? alert.device.deviceId);

      try {
        let order;
        let charged = false;
        // Every outcome must move the alert out of "notified", or the next
        // cron run would re-process it and create a duplicate order.
        let alertOutcome: "auto_ordered" | "payment_failed" = "auto_ordered";

        if (preference?.filterProduct) {
          const product = preference.filterProduct;
          const user = alert.user;
          const subtotal = product.price;
          const shipping = AUTO_ORDER_SHIPPING_CENTS;
          const total = subtotal + shipping;

          const canCharge =
            !!user.stripeCustomerId &&
            !!user.stripeDefaultPaymentMethodId &&
            !!user.shippingAddress1;

          // Create the order first so the charge has something to reference
          order = await db.order.create({
            data: {
              userId: alert.userId,
              isAutoOrder: true,
              triggeredByAlertId: alert.id,
              status: "pending",
              subtotal,
              tax: 0,
              shipping,
              total,
              shippingName: user.shippingName,
              shippingAddress1: user.shippingAddress1,
              shippingAddress2: user.shippingAddress2,
              shippingCity: user.shippingCity,
              shippingState: user.shippingState,
              shippingZip: user.shippingZip,
              shippingCountry: user.shippingCountry,
              orderItems: {
                create: {
                  filterProductId: product.id,
                  quantity: 1,
                  priceAtPurchase: product.price,
                },
              },
            },
          });

          if (canCharge) {
            try {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: total,
                currency: "usd",
                customer: user.stripeCustomerId!,
                payment_method: user.stripeDefaultPaymentMethodId!,
                off_session: true,
                confirm: true,
                metadata: { orderId: order.id, userId: alert.userId, autoOrder: "true" },
              });

              order = await db.order.update({
                where: { id: order.id },
                data: { status: "paid", stripePaymentIntent: paymentIntent.id },
              });
              charged = true;
            } catch (chargeError) {
              // Card declined / requires action — order stays pending, user is emailed
              console.error(`[cron/auto-order] Charge failed for order ${order.id}:`, chargeError);
              alertOutcome = "payment_failed";
            }
          }
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

        // Always resolve the alert so it isn't re-processed next run
        await db.filterAlert.update({
          where: { id: alert.id },
          data: {
            status: alertOutcome,
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
            subject:
              alertOutcome === "payment_failed"
                ? `⚠️ Payment failed for your filter auto-order — ${deviceName}`
                : `✅ Your replacement filter has been ordered — ${deviceName}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eeebe4;">
    <!-- Header -->
    <div style="background:#faf8f5;padding:24px 32px;border-bottom:1px solid #eeebe4;">
      <p style="margin:0;color:#3e8a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#1c1b18;font-size:22px;font-weight:700;">${
        alertOutcome === "payment_failed"
          ? "⚠️ Payment needs attention"
          : "✅ Filter order confirmed"
      }</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#55524a;font-size:15px;margin-top:0;">
        ${
          alertOutcome === "payment_failed"
            ? `We tried to charge your card on file for the replacement filter for <strong style="color:#1c1b18;">${deviceName}</strong>, but the payment didn't go through. Update your card at <a href="https://mysmartfilter.com/settings/billing" style="color:#3e8a72;">mysmartfilter.com/settings/billing</a> or order manually from the store.`
            : charged
              ? `Your replacement filter for <strong style="color:#1c1b18;">${deviceName}</strong> has been ordered and your card on file was charged.`
              : `Your replacement filter order for <strong style="color:#1c1b18;">${deviceName}</strong> has been created. Add a card at <a href="https://mysmartfilter.com/settings/billing" style="color:#3e8a72;">mysmartfilter.com/settings/billing</a> to make future orders fully automatic.`
        }
      </p>

      <!-- Order info -->
      <div style="background:#faf8f5;border:1px solid #eeebe4;border-radius:12px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Order #</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;font-family:monospace;">${order.id.slice(-8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Device</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;font-weight:600;">${deviceName}</td>
          </tr>
          ${alert.device.location ? `<tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Location</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;">${alert.device.location}</td>
          </tr>` : ""}
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Item</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;">${productName}${productSize ? ` (${productSize})` : ""}</td>
          </tr>
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Total</td>
            <td style="color:#3e8a72;font-size:13px;text-align:right;font-weight:700;">${totalFormatted}</td>
          </tr>
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Status</td>
            <td style="color:#2e6c59;font-size:13px;text-align:right;">Processing</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="https://mysmartfilter.com/orders/${order.id}"
           style="display:inline-block;background:#3e8a72;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:15px;">
          View Order Details
        </a>
      </div>

      <p style="color:#8a867c;font-size:13px;margin-bottom:0;">
        You'll receive a shipping notification once your order ships.
        To manage auto-order settings, <a href="https://mysmartfilter.com/settings" style="color:#3e8a72;">visit your settings</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#faf8f5;padding:20px 32px;border-top:1px solid #eeebe4;">
      <p style="margin:0;color:#8a867c;font-size:12px;text-align:center;">
        This order was placed automatically based on your filter preferences.<br>
        <a href="https://mysmartfilter.com/settings/notifications" style="color:#3e8a72;">Manage auto-order settings</a>
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
