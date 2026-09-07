import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resend, EMAIL_FROM } from "~/lib/resend";

/**
 * POST /api/admin/orders/[orderId]/ship
 * Admin marks a paid order shipped with a tracking number; customer gets a
 * shipping-notification email.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!me?.isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { orderId } = await params;
    const body = (await request.json()) as { trackingNumber?: string };
    const trackingNumber = body.trackingNumber?.trim();

    if (!trackingNumber) {
      return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true } },
        orderItems: { include: { filterProduct: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: `Order is '${order.status}' — only paid orders can ship` },
        { status: 400 }
      );
    }

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        status: "shipped",
        trackingNumber,
        shippedAt: new Date(),
      },
    });

    // Shipping notification
    if (order.user.email) {
      const itemsList = order.orderItems
        .map((i) => `${i.quantity}× ${i.filterProduct.size} — ${i.filterProduct.name}`)
        .join("<br>");
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: order.user.email,
          subject: `📦 Your filter order has shipped — #${order.id.slice(-8).toUpperCase()}`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eeebe4;">
    <div style="background:#faf8f5;padding:24px 32px;border-bottom:1px solid #eeebe4;">
      <p style="margin:0;color:#3e8a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#1c1b18;font-size:22px;font-weight:700;">📦 Your order is on the way</h1>
    </div>
    <div style="padding:28px 32px;">
      <div style="background:#faf8f5;border:1px solid #eeebe4;border-radius:12px;padding:20px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Order #</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;font-family:monospace;">${order.id.slice(-8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Items</td>
            <td style="color:#1c1b18;font-size:13px;text-align:right;">${itemsList}</td>
          </tr>
          <tr>
            <td style="color:#8a867c;font-size:13px;padding:6px 0;">Tracking</td>
            <td style="color:#3e8a72;font-size:13px;text-align:right;font-family:monospace;">${trackingNumber}</td>
          </tr>
        </table>
      </div>
      <p style="color:#8a867c;font-size:13px;margin:0;">
        Track your package with the number above via your carrier.
        Questions? Just reply to this email.
      </p>
    </div>
    <div style="background:#faf8f5;padding:20px 32px;border-top:1px solid #eeebe4;">
      <p style="margin:0;color:#8a867c;font-size:12px;text-align:center;">
        <a href="https://mysmartfilter.com/store/orders" style="color:#3e8a72;">View your orders</a>
      </p>
    </div>
  </div>
</body>
</html>`,
        });
      } catch (emailErr) {
        console.error(`Shipped email failed for order ${orderId}:`, emailErr);
      }
    }

    return NextResponse.json({ success: true, order: { id: updated.id, status: updated.status } });
  } catch (error) {
    console.error("Error marking order shipped:", error);
    return NextResponse.json({ error: "Failed to mark shipped" }, { status: 500 });
  }
}
